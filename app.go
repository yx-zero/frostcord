package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"frostcord/internal/discord"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails-bound backend. The frontend calls its exported methods and
// listens for the events it emits (cd:ready, cd:message, cd:status, ...).
type App struct {
	ctx context.Context

	mu      sync.Mutex
	rest    *discord.REST
	gateway *discord.Gateway
	self    *discord.User
	store   *accountStore

	// QR (remote-auth) login.
	remoteAuth *discord.RemoteAuth

	// Autocomplete waiters: nonce -> channel awaiting the gateway response.
	acMu      sync.Mutex
	acWaiters map[string]chan []discord.AutocompleteChoice
}

func NewApp() *App {
	return &App{
		store:     newAccountStore(),
		acWaiters: make(map[string]chan []discord.AutocompleteChoice),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ---- DTOs returned to the frontend (camelCase, UI-shaped) -----------------

type UserDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Bot         bool   `json:"bot"`
}

type GuildDTO struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	IconURL string `json:"iconUrl"`
	Acronym string `json:"acronym"`
}

type ChannelDTO struct {
	ID       string `json:"id"`
	GuildID  string `json:"serverId"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Topic    string `json:"topic"`
	ParentID string `json:"parentId"`
	Position int    `json:"position"`
	// DM-specific
	IsDM       bool      `json:"isDM"`
	AvatarURL  string    `json:"avatarUrl"`
	Subtitle   string    `json:"subtitle"`
	Recipients []UserDTO `json:"recipients"`
}

type AttachmentDTO struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Name   string `json:"name"`
}

type ReplyDTO struct {
	ID         string `json:"id"`
	AuthorName string `json:"authorName"`
	Preview    string `json:"preview"`
}

type EmbedFieldDTO struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type EmbedDTO struct {
	Type        string          `json:"type"`
	URL         string          `json:"url"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Color       string          `json:"color"` // css hex like #5865f2, empty if none
	AuthorName  string          `json:"authorName"`
	AuthorIcon  string          `json:"authorIcon"`
	AuthorURL   string          `json:"authorUrl"`
	FooterText  string          `json:"footerText"`
	FooterIcon  string          `json:"footerIcon"`
	ProviderNm  string          `json:"providerName"`
	ImageURL    string          `json:"imageUrl"`
	ThumbURL    string          `json:"thumbUrl"`
	VideoURL    string          `json:"videoUrl"`
	Fields      []EmbedFieldDTO `json:"fields"`
}

type ReactionDTO struct {
	Emoji    string `json:"emoji"`    // unicode char OR custom name
	EmojiURL string `json:"emojiUrl"` // for custom emoji
	Count    int    `json:"count"`
	Me       bool   `json:"me"`
}

type ButtonDTO struct {
	Label    string `json:"label"`
	Style    int    `json:"style"`
	URL      string `json:"url"`
	Disabled bool   `json:"disabled"`
	EmojiURL string `json:"emojiUrl"`
	Emoji    string `json:"emoji"`
}

type PollOptionDTO struct {
	ID    int    `json:"id"`
	Text  string `json:"text"`
	Count int    `json:"count"`
	Me    bool   `json:"me"`
}

type PollDTO struct {
	Question   string          `json:"question"`
	Options    []PollOptionDTO `json:"options"`
	TotalVotes int             `json:"totalVotes"`
	Finalized  bool            `json:"finalized"`
	Multi      bool            `json:"multi"`
}

type MessageDTO struct {
	ID          string          `json:"id"`
	ChannelID   string          `json:"channelId"`
	Author      UserDTO         `json:"author"`
	Content     string          `json:"content"`
	Timestamp   string          `json:"timestamp"`
	Edited      bool            `json:"edited"`
	Mine        bool            `json:"mine"`
	Nonce       string          `json:"nonce"`
	Type        int             `json:"msgType"`
	Attachments []AttachmentDTO `json:"attachments"`
	Embeds      []EmbedDTO      `json:"embeds"`
	Reactions   []ReactionDTO   `json:"reactions"`
	Buttons     []ButtonDTO     `json:"buttons"`
	Poll        *PollDTO        `json:"poll"`
	Reply       *ReplyDTO       `json:"replyTo"`
	// Interaction is set when this message is a bot's reply to a slash command:
	// who used which command (for the "X used /command" header).
	Interaction *InteractionDTO `json:"interaction"`
	// Mentions maps user id -> display name so the UI can render <@id> nicely.
	Mentions map[string]string `json:"mentions"`
}

// InteractionDTO carries the slash-command invocation a bot reply responds to.
type InteractionDTO struct {
	Name     string `json:"name"`     // command name, e.g. "stock"
	UserName string `json:"userName"` // invoking user's display name
}

type GifDTO struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	PreviewURL string `json:"previewUrl"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
}

type LoginResult struct {
	OK    bool    `json:"ok"`
	Error string  `json:"error"`
	User  UserDTO `json:"user"`
}

// ---- conversion helpers ---------------------------------------------------

func acronym(name string) string {
	out := ""
	prev := true
	for _, r := range name {
		if r == ' ' {
			prev = true
			continue
		}
		if prev {
			out += string(r)
			prev = false
		}
	}
	if len(out) > 4 {
		out = out[:4]
	}
	if out == "" {
		out = "?"
	}
	return out
}

func toUserDTO(u discord.User) UserDTO {
	return UserDTO{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName(),
		AvatarURL:   u.AvatarURL(),
		Bot:         u.Bot,
	}
}

func channelTypeName(t int) string {
	switch t {
	case discord.ChannelGuildVoice:
		return "voice"
	case discord.ChannelGuildCategory:
		return "category"
	case discord.ChannelAnnouncement:
		return "announcement"
	default:
		return "text"
	}
}

func (a *App) toMessageDTO(m *discord.Message) MessageDTO {
	mine := false
	a.mu.Lock()
	if a.self != nil && m.Author.ID == a.self.ID {
		mine = true
	}
	a.mu.Unlock()

	atts := make([]AttachmentDTO, 0, len(m.Attachments))
	for _, at := range m.Attachments {
		atts = append(atts, AttachmentDTO{
			ID:    at.ID,
			Type:  classifyAttachment(at.ContentType, at.Filename),
			URL:   at.URL,
			Width: at.Width, Height: at.Height, Name: at.Filename,
		})
	}
	// Process embeds: pure media embeds (image/gifv/video with no text) render
	// inline as attachments (the Discord way); rich embeds become embed cards.
	embeds := make([]EmbedDTO, 0, len(m.Embeds))
	for i, e := range m.Embeds {
		isRich := e.Title != "" || e.Description != "" ||
			e.Author != nil || len(e.Fields) > 0 || e.Footer != nil

		if !isRich {
			// Bare media embed -> inline attachment.
			if e.Video != nil && e.Video.URL != "" {
				atts = append(atts, AttachmentDTO{
					ID: fmt.Sprintf("%s_embed_v%d", m.ID, i), Type: "video",
					URL: e.Video.URL, Width: e.Video.Width, Height: e.Video.Height,
				})
				continue
			}
			if e.Image != nil && e.Image.URL != "" {
				url := e.Image.ProxyURL
				if url == "" {
					url = e.Image.URL
				}
				atts = append(atts, AttachmentDTO{
					ID: fmt.Sprintf("%s_embed_i%d", m.ID, i), Type: "image",
					URL: url, Width: e.Image.Width, Height: e.Image.Height,
				})
				continue
			}
			if e.Thumbnail != nil && e.Thumbnail.URL != "" {
				url := e.Thumbnail.ProxyURL
				if url == "" {
					url = e.Thumbnail.URL
				}
				atts = append(atts, AttachmentDTO{
					ID: fmt.Sprintf("%s_embed_t%d", m.ID, i), Type: "image",
					URL: url, Width: e.Thumbnail.Width, Height: e.Thumbnail.Height,
				})
				continue
			}
			// nothing renderable — skip
			continue
		}

		// Rich embed card.
		dto := EmbedDTO{
			Type:        e.Type,
			URL:         e.URL,
			Title:       e.Title,
			Description: e.Description,
		}
		if e.Color != 0 {
			dto.Color = fmt.Sprintf("#%06x", e.Color&0xffffff)
		}
		if e.Author != nil {
			dto.AuthorName = e.Author.Name
			dto.AuthorIcon = e.Author.IconURL
			dto.AuthorURL = e.Author.URL
		}
		if e.Footer != nil {
			dto.FooterText = e.Footer.Text
			dto.FooterIcon = e.Footer.IconURL
		}
		if e.Provider != nil {
			dto.ProviderNm = e.Provider.Name
		}
		if e.Image != nil {
			dto.ImageURL = firstNonEmpty(e.Image.ProxyURL, e.Image.URL)
		}
		if e.Thumbnail != nil {
			dto.ThumbURL = firstNonEmpty(e.Thumbnail.ProxyURL, e.Thumbnail.URL)
		}
		if e.Video != nil {
			dto.VideoURL = e.Video.URL
		}
		for _, f := range e.Fields {
			dto.Fields = append(dto.Fields, EmbedFieldDTO{
				Name: f.Name, Value: f.Value, Inline: f.Inline,
			})
		}
		embeds = append(embeds, dto)
	}

	// Build mention id -> display name map.
	mentions := make(map[string]string, len(m.Mentions))
	for _, u := range m.Mentions {
		mentions[u.ID] = u.DisplayName()
	}

	var reply *ReplyDTO
	if m.ReferencedMessage != nil {
		preview := m.ReferencedMessage.Content
		if len(preview) > 60 {
			preview = preview[:60] + "…"
		}
		reply = &ReplyDTO{
			ID:         m.ReferencedMessage.ID,
			AuthorName: m.ReferencedMessage.Author.DisplayName(),
			Preview:    preview,
		}
	}

	// Reactions.
	reactions := make([]ReactionDTO, 0, len(m.Reactions))
	for _, rx := range m.Reactions {
		emoji := rx.Emoji.Name
		emojiURL := ""
		if rx.Emoji.ID != "" {
			ext := "png"
			if rx.Emoji.Animated {
				ext = "gif"
			}
			emojiURL = "https://cdn.discordapp.com/emojis/" + rx.Emoji.ID + "." + ext + "?size=48"
		}
		reactions = append(reactions, ReactionDTO{
			Emoji: emoji, EmojiURL: emojiURL, Count: rx.Count, Me: rx.Me,
		})
	}

	// Bot buttons (flatten action rows -> buttons; type 2 = button).
	buttons := make([]ButtonDTO, 0)
	for _, row := range m.Components {
		for _, c := range row.Components {
			if c.Type != 2 {
				continue
			}
			b := ButtonDTO{Label: c.Label, Style: c.Style, URL: c.URL, Disabled: c.Disabled}
			if c.Emoji != nil {
				if c.Emoji.ID != "" {
					ext := "png"
					if c.Emoji.Animated {
						ext = "gif"
					}
					b.EmojiURL = "https://cdn.discordapp.com/emojis/" + c.Emoji.ID + "." + ext + "?size=24"
				} else {
					b.Emoji = c.Emoji.Name
				}
			}
			buttons = append(buttons, b)
		}
	}

	// Poll.
	var poll *PollDTO
	if m.Poll != nil {
		p := &PollDTO{
			Question:  m.Poll.Question.Text,
			Finalized: m.Poll.Results != nil && m.Poll.Results.IsFinalized,
			Multi:     m.Poll.AllowMultiselect,
		}
		countByID := map[int]struct {
			count int
			me    bool
		}{}
		if m.Poll.Results != nil {
			for _, ac := range m.Poll.Results.AnswerCounts {
				countByID[ac.ID] = struct {
					count int
					me    bool
				}{ac.Count, ac.MeVoted}
			}
		}
		for _, ans := range m.Poll.Answers {
			c := countByID[ans.AnswerID]
			p.Options = append(p.Options, PollOptionDTO{
				ID: ans.AnswerID, Text: ans.PollMedia.Text, Count: c.count, Me: c.me,
			})
			p.TotalVotes += c.count
		}
		poll = p
	}

	var interaction *InteractionDTO
	if m.Interaction != nil {
		interaction = &InteractionDTO{
			Name:     m.Interaction.Name,
			UserName: m.Interaction.User.DisplayName(),
		}
	}

	return MessageDTO{
		ID:          m.ID,
		ChannelID:   m.ChannelID,
		Author:      toUserDTO(m.Author),
		Content:     m.Content,
		Timestamp:   m.Timestamp,
		Edited:      m.EditedTimestamp != "",
		Mine:        mine,
		Nonce:       m.Nonce,
		Type:        m.Type,
		Attachments: atts,
		Embeds:      embeds,
		Reactions:   reactions,
		Buttons:     buttons,
		Poll:        poll,
		Reply:       reply,
		Interaction: interaction,
		Mentions:    mentions,
	}
}

// firstNonEmpty returns the first non-empty string.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// classifyAttachment determines the UI attachment type from content-type, then
// falls back to the filename extension (content-type is often empty).
func classifyAttachment(contentType, filename string) string {
	if contentType == "image/gif" {
		return "gif"
	}
	if len(contentType) >= 5 && contentType[:5] == "image" {
		return "image"
	}
	if len(contentType) >= 5 && contentType[:5] == "video" {
		return "video"
	}
	ext := ""
	if i := strings.LastIndex(filename, "."); i >= 0 {
		ext = strings.ToLower(filename[i+1:])
	}
	switch ext {
	case "gif":
		return "gif"
	case "png", "jpg", "jpeg", "webp", "bmp", "avif", "apng":
		return "image"
	case "mp4", "webm", "mov", "mkv", "avi", "m4v":
		return "video"
	case "mp3", "ogg", "wav", "flac", "m4a":
		return "audio"
	default:
		return "file"
	}
}

// ============================================================
// Exported methods (called from the frontend via Wails bindings)
// ============================================================

// Login validates the token via REST, then opens the gateway. Returns the
// authenticated user on success.
// Login authenticates with a raw token, starts the session, and saves the
// account locally for the switcher.
func (a *App) Login(token string) LoginResult {
	rest := discord.NewREST(token)
	self, err := rest.CurrentUser()
	if err != nil {
		return LoginResult{OK: false, Error: err.Error()}
	}
	a.startSession(token, rest, self)
	a.saveAccount(token, self)
	return LoginResult{OK: true, User: toUserDTO(*self)}
}

// startSession wires the REST client + gateway for a validated token.
func (a *App) startSession(token string, rest *discord.REST, self *discord.User) {
	a.mu.Lock()
	a.rest = rest
	a.self = self
	if a.gateway != nil {
		a.gateway.Close()
	}
	a.gateway = discord.NewGateway(token, a)
	gw := a.gateway
	a.mu.Unlock()
	go gw.Connect()
}

// saveAccount persists/updates the account for the switcher UI.
func (a *App) saveAccount(token string, self *discord.User) {
	if a.store == nil {
		return
	}
	_ = a.store.upsert(Account{
		ID:         self.ID,
		Username:   self.Username,
		GlobalName: self.GlobalName,
		AvatarURL:  self.AvatarURL(),
		Token:      token,
	})
}

// ---- QR (remote-auth) login -----------------------------------------------

// finishTokenLogin validates a freshly-obtained token, starts the session, saves
// the account, and returns the authenticated user.
func (a *App) finishTokenLogin(token string) error {
	rest := discord.NewREST(token)
	self, err := rest.CurrentUser()
	if err != nil {
		return err
	}
	a.startSession(token, rest, self)
	a.saveAccount(token, self)
	return nil
}

// StartQRLogin begins the QR remote-auth flow. Emits events:
//
//	cd:qr        -> { url }            (encode as QR for the phone to scan)
//	cd:qrUser    -> { id, username, ... } (user scanned, preview)
//	cd:qrToken   -> handled internally: logs in + emits cd:ready via gateway
//	cd:qrError   -> { error }
func (a *App) StartQRLogin() {
	a.mu.Lock()
	if a.remoteAuth != nil {
		a.remoteAuth.Close()
	}
	a.remoteAuth = discord.NewRemoteAuth(a)
	ra := a.remoteAuth
	a.mu.Unlock()
	ra.Start()
}

// CancelQRLogin stops an in-progress QR login.
func (a *App) CancelQRLogin() {
	a.mu.Lock()
	if a.remoteAuth != nil {
		a.remoteAuth.Close()
		a.remoteAuth = nil
	}
	a.mu.Unlock()
}

// --- RemoteAuthHandler implementation ---

func (a *App) OnQRCode(url string) {
	a.emit("cd:qr", map[string]string{"url": url})
}

func (a *App) OnPendingUser(id, username, discriminator, avatar string) {
	avatarURL := ""
	if avatar != "" && avatar != "0" {
		ext := "png"
		if len(avatar) > 2 && avatar[:2] == "a_" {
			ext = "gif"
		}
		avatarURL = "https://cdn.discordapp.com/avatars/" + id + "/" + avatar + "." + ext + "?size=128"
	}
	a.emit("cd:qrUser", map[string]string{
		"id": id, "username": username,
		"discriminator": discriminator, "avatarUrl": avatarURL,
	})
}

func (a *App) OnToken(token string) {
	// Log in with the received token and tell the UI we're authenticated.
	if err := a.finishTokenLogin(token); err != nil {
		a.emit("cd:qrError", map[string]string{"error": err.Error()})
		return
	}
	a.mu.Lock()
	self := a.self
	a.mu.Unlock()
	if self != nil {
		a.emit("cd:qrSuccess", toUserDTO(*self))
	}
}

func (a *App) OnRAError(err error) {
	a.emit("cd:qrError", map[string]string{"error": err.Error()})
}

// ---- Account management ----------------------------------------------------

type AccountDTO struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"globalName"`
	AvatarURL  string `json:"avatarUrl"`
}

// ListAccounts returns saved accounts (without exposing tokens to the UI).
func (a *App) ListAccounts() []AccountDTO {
	if a.store == nil {
		return nil
	}
	accts, err := a.store.load()
	if err != nil {
		return nil
	}
	out := make([]AccountDTO, 0, len(accts))
	for _, ac := range accts {
		out = append(out, AccountDTO{
			ID: ac.ID, Username: ac.Username,
			GlobalName: ac.GlobalName, AvatarURL: ac.AvatarURL,
		})
	}
	return out
}

// SwitchAccount logs into a saved account by id.
func (a *App) SwitchAccount(id string) LoginResult {
	if a.store == nil {
		return LoginResult{OK: false, Error: "no account store"}
	}
	accts, err := a.store.load()
	if err != nil {
		return LoginResult{OK: false, Error: err.Error()}
	}
	for _, ac := range accts {
		if ac.ID == id {
			return a.Login(ac.Token)
		}
	}
	return LoginResult{OK: false, Error: "account not found"}
}

// RemoveAccount deletes a saved account.
func (a *App) RemoveAccount(id string) {
	if a.store != nil {
		_ = a.store.remove(id)
	}
}

// Logout closes the gateway and clears state.
func (a *App) Logout() {
	a.mu.Lock()
	if a.gateway != nil {
		a.gateway.Close()
		a.gateway = nil
	}
	a.rest = nil
	a.self = nil
	a.mu.Unlock()
}

func (a *App) GetGuilds() ([]GuildDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	guilds, err := rest.Guilds()
	if err != nil {
		return nil, err
	}
	out := make([]GuildDTO, 0, len(guilds))
	for _, g := range guilds {
		out = append(out, GuildDTO{
			ID: g.ID, Name: g.Name, IconURL: g.IconURL(), Acronym: acronym(g.Name),
		})
	}
	// Apply the user's real sidebar order from the settings protobuf.
	order, oerr := rest.GuildOrder()
	if oerr != nil {
		// Non-fatal: fall back to alphabetical if the proto can't be read.
		sortGuilds(out)
	} else {
		orderGuildsByIDs(out, order)
	}
	return out, nil
}

type RoleDTO struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"` // "#rrggbb", empty if the role has no color
}

// GetRoles returns a guild's mentionable named roles (for @role rendering and
// the @ autocomplete). @everyone is excluded — it's handled as @everyone text.
func (a *App) GetRoles(guildID string) ([]RoleDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil || guildID == "" || guildID == "@me" {
		return nil, nil
	}
	roles, err := rest.GuildRoles(guildID)
	if err != nil {
		return nil, err
	}
	out := make([]RoleDTO, 0, len(roles))
	for _, r := range roles {
		if r.Name == "@everyone" {
			continue
		}
		color := ""
		if r.Color != 0 {
			color = fmt.Sprintf("#%06x", r.Color)
		}
		out = append(out, RoleDTO{ID: r.ID, Name: r.Name, Color: color})
	}
	return out, nil
}

type ServerFolderDTO struct {
	ID       string   `json:"id"`    // folder id; empty => standalone guild
	Name     string   `json:"name"`  // folder name (may be empty)
	Color    string   `json:"color"` // "#rrggbb" or ""
	GuildIDs []string `json:"guildIds"`
}

// GetGuildFolders returns the user's sidebar folder grouping. Standalone guilds
// come back as single-guild entries with an empty ID.
func (a *App) GetGuildFolders() ([]ServerFolderDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	folders, err := rest.GuildFolders()
	if err != nil {
		return nil, err
	}
	out := make([]ServerFolderDTO, 0, len(folders))
	for _, f := range folders {
		color := ""
		if f.Color != 0 {
			color = fmt.Sprintf("#%06x", f.Color)
		}
		out = append(out, ServerFolderDTO{ID: f.ID, Name: f.Name, Color: color, GuildIDs: f.GuildIDs})
	}
	return out, nil
}

// sortGuilds orders guilds alphabetically (case-insensitive) for a stable,
// predictable server list. (Discord's REST guild order isn't meaningful.)
func sortGuilds(gs []GuildDTO) {
	sort.SliceStable(gs, func(i, j int) bool {
		return strings.ToLower(gs[i].Name) < strings.ToLower(gs[j].Name)
	})
}

// orderGuildsByIDs reorders gs in place to match the given id order (the user's
// real sidebar order). Guilds not in the order list keep relative order and go
// after the ordered ones, sorted alphabetically.
func orderGuildsByIDs(gs []GuildDTO, order []string) {
	if len(order) == 0 {
		sortGuilds(gs)
		return
	}
	rank := make(map[string]int, len(order))
	for i, id := range order {
		rank[id] = i
	}
	sort.SliceStable(gs, func(i, j int) bool {
		ri, oki := rank[gs[i].ID]
		rj, okj := rank[gs[j].ID]
		if oki && okj {
			return ri < rj
		}
		if oki != okj {
			return oki // ranked ones come first
		}
		return strings.ToLower(gs[i].Name) < strings.ToLower(gs[j].Name)
	})
}

func (a *App) GetChannels(guildID string) ([]ChannelDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	chans, err := rest.GuildChannels(guildID)
	if err != nil {
		return nil, err
	}
	out := make([]ChannelDTO, 0, len(chans))
	for _, c := range chans {
		out = append(out, ChannelDTO{
			ID: c.ID, GuildID: c.GuildID, Name: c.Name,
			Type: channelTypeName(c.Type), Topic: c.Topic,
			ParentID: c.ParentID, Position: c.Position,
		})
	}
	return out, nil
}

// GetDMChannels lists the user's direct-message and group-DM channels, shaped
// for the UI: each becomes a "text" channel named after the recipient(s).
func (a *App) GetDMChannels() ([]ChannelDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	chans, err := rest.DMChannels()
	if err != nil {
		return nil, err
	}

	// Sort by recency: last_message_id is a snowflake, so lexicographically
	// larger (and longer) ids are newer. Most-recent first, like Discord.
	sort.SliceStable(chans, func(i, j int) bool {
		return snowflakeGreater(chans[i].LastMessageID, chans[j].LastMessageID)
	})

	out := make([]ChannelDTO, 0, len(chans))
	for _, c := range chans {
		name := c.Name
		avatar := ""
		subtitle := ""
		if c.Type == discord.ChannelGroupDM {
			// Group DM: name or member list, generic avatar.
			if name == "" {
				names := make([]string, 0, len(c.Recipients))
				for _, r := range c.Recipients {
					names = append(names, r.DisplayName())
				}
				name = strings.Join(names, ", ")
			}
			subtitle = fmt.Sprintf("%d members", len(c.Recipients)+1)
		} else {
			// 1:1 DM: use the single recipient's name + avatar.
			if len(c.Recipients) > 0 {
				r := c.Recipients[0]
				if name == "" {
					name = r.DisplayName()
				}
				avatar = r.AvatarURL()
				subtitle = "@" + r.Username
			}
		}
		if name == "" {
			name = "Unknown"
		}
		// Include all recipients so the UI can show group-DM members.
		recips := make([]UserDTO, 0, len(c.Recipients))
		for _, r := range c.Recipients {
			recips = append(recips, toUserDTO(r))
		}
		out = append(out, ChannelDTO{
			ID: c.ID, GuildID: "@me", Name: name, Type: "text",
			IsDM: true, AvatarURL: avatar, Subtitle: subtitle,
			Recipients: recips,
		})
	}
	return out, nil
}

// snowflakeGreater reports whether snowflake a is newer than b.
func snowflakeGreater(a, b string) bool {
	if len(a) != len(b) {
		return len(a) > len(b)
	}
	return a > b
}

func (a *App) GetMessages(channelID string) ([]MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	msgs, err := rest.Messages(channelID, 50)
	if err != nil {
		return nil, err
	}
	// Discord returns newest-first; reverse to chronological for the UI.
	out := make([]MessageDTO, 0, len(msgs))
	for i := len(msgs) - 1; i >= 0; i-- {
		out = append(out, a.toMessageDTO(&msgs[i]))
	}
	return out, nil
}

// GetMessagesBefore loads older messages before a given id (pagination).
func (a *App) GetMessagesBefore(channelID, beforeID string) ([]MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	msgs, err := rest.MessagesBefore(channelID, beforeID, 50)
	if err != nil {
		return nil, err
	}
	out := make([]MessageDTO, 0, len(msgs))
	for i := len(msgs) - 1; i >= 0; i-- {
		out = append(out, a.toMessageDTO(&msgs[i]))
	}
	return out, nil
}

// EditMessage edits one of the user's own messages.
func (a *App) EditMessage(channelID, messageID, content string) (MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return MessageDTO{}, nil
	}
	m, err := rest.EditMessage(channelID, messageID, content)
	if err != nil {
		return MessageDTO{}, err
	}
	return a.toMessageDTO(m), nil
}

// AddReaction / RemoveReaction toggle the user's reaction on a message.
func (a *App) AddReaction(channelID, messageID, emoji string) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.AddReaction(channelID, messageID, emoji)
}

func (a *App) RemoveReaction(channelID, messageID, emoji string) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.RemoveReaction(channelID, messageID, emoji)
}

// VotePoll casts a vote on a poll message.
func (a *App) VotePoll(channelID, messageID string, answerIDs []int) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.VotePoll(channelID, messageID, answerIDs)
}

// FriendDTO is a relationship entry for the friends list.
type FriendDTO struct {
	ID   string  `json:"id"`
	Type int     `json:"type"` // 1=friend, 3=incoming, 4=outgoing, 2=blocked
	User UserDTO `json:"user"`
}

// GetFriends lists the user's relationships (friends / pending / blocked).
func (a *App) GetFriends() ([]FriendDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	rels, err := rest.Relationships()
	if err != nil {
		return nil, err
	}
	out := make([]FriendDTO, 0, len(rels))
	for _, r := range rels {
		out = append(out, FriendDTO{ID: r.ID, Type: r.Type, User: toUserDTO(r.User)})
	}
	return out, nil
}

// AcceptFriend / RemoveFriend manage relationships.
func (a *App) AcceptFriend(userID string) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.AcceptRelationship(userID)
}

func (a *App) RemoveFriend(userID string) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.RemoveRelationship(userID)
}

func (a *App) SendMessage(channelID, content, nonce, replyToID string) (MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return MessageDTO{}, nil
	}
	m, err := rest.SendMessage(channelID, content, nonce, replyToID)
	if err != nil {
		return MessageDTO{}, err
	}
	return a.toMessageDTO(m), nil
}

// DeleteMessage permanently deletes a message via REST.
func (a *App) DeleteMessage(channelID, messageID string) error {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil
	}
	return rest.DeleteMessage(channelID, messageID)
}

// ProfileDTO is the rich profile shown in the profile popout.
type ProfileDTO struct {
	ID          string   `json:"id"`
	Username    string   `json:"username"`
	DisplayName string   `json:"displayName"`
	AvatarURL   string   `json:"avatarUrl"`
	BannerURL   string   `json:"bannerUrl"`
	AccentColor string   `json:"accentColor"` // css hex or empty
	Bio         string   `json:"bio"`
	Pronouns    string   `json:"pronouns"`
	Bot         bool     `json:"bot"`
	BadgeIcons  []string `json:"badgeIcons"`
}

// GetUserProfile fetches a user's full profile (banner, bio, pronouns, badges).
func (a *App) GetUserProfile(userID string) (ProfileDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return ProfileDTO{}, nil
	}
	p, err := rest.UserProfile(userID)
	if err != nil {
		return ProfileDTO{}, err
	}
	display := p.User.GlobalName
	if display == "" {
		display = p.User.Username
	}
	bio := p.User.Bio
	if bio == "" {
		bio = p.UserProfile.Bio
	}
	pronouns := p.User.Pronouns
	if pronouns == "" {
		pronouns = p.UserProfile.Pronouns
	}
	accent := ""
	col := p.User.AccentColor
	if col == nil {
		col = p.UserProfile.AccentColor
	}
	if col != nil {
		accent = fmt.Sprintf("#%06x", *col&0xffffff)
	}
	badges := make([]string, 0, len(p.Badges))
	for _, b := range p.Badges {
		if b.Icon != "" {
			badges = append(badges,
				"https://cdn.discordapp.com/badge-icons/"+b.Icon+".png")
		}
	}
	return ProfileDTO{
		ID:          p.User.ID,
		Username:    p.User.Username,
		DisplayName: display,
		AvatarURL:   p.AvatarURL(),
		BannerURL:   p.BannerURL(),
		AccentColor: accent,
		Bio:         bio,
		Pronouns:    pronouns,
		Bot:         p.User.Bot,
		BadgeIcons:  badges,
	}, nil
}

// RequestMembers loads a guild's member list. It tries the REST member-search
// (returns ALL members incl. offline, but needs MANAGE_GUILD) and always also
// triggers the gateway lazy member list (op 14) which works everywhere but is
// mostly online members. Both feed the cd:members event.
func (a *App) RequestMembers(guildID, channelID string) {
	a.mu.Lock()
	gw := a.gateway
	rest := a.rest
	a.mu.Unlock()
	if guildID == "" || guildID == "@me" {
		return
	}
	if gw != nil {
		_ = gw.RequestGuildMembers(guildID, channelID)
	}
	if rest != nil {
		// Best-effort full member list; ignore 403 (no manage perms).
		go func() {
			members, err := rest.SearchGuildMembers(guildID, "", 1000)
			if err != nil || len(members) == 0 {
				return
			}
			a.OnMemberListUpdate(guildID, members)
		}()
	}
}

// GetPinnedMessages fetches the pinned messages for a channel (chronological).
func (a *App) GetPinnedMessages(channelID string) ([]MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	msgs, err := rest.PinnedMessages(channelID)
	if err != nil {
		return nil, err
	}
	out := make([]MessageDTO, 0, len(msgs))
	for i := len(msgs) - 1; i >= 0; i-- {
		out = append(out, a.toMessageDTO(&msgs[i]))
	}
	return out, nil
}

// GetFavoriteGifs fetches the user's account-synced favorite GIFs from the
// FRECENCY settings proto.
func (a *App) GetFavoriteGifs() ([]GifDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	favs, err := rest.FavoriteGifs()
	if err != nil {
		return nil, err
	}
	out := make([]GifDTO, 0, len(favs))
	for _, f := range favs {
		// f.URL is the shareable gif link (posted as content); f.Src is the
		// media/preview. Prefer URL for sending, Src for the thumbnail.
		sendURL := f.URL
		if sendURL == "" {
			sendURL = f.Src
		}
		preview := f.Src
		if preview == "" {
			preview = f.URL
		}
		if sendURL == "" && preview == "" {
			continue // skip empty/broken entries
		}
		out = append(out, GifDTO{
			ID: f.URL, URL: sendURL, PreviewURL: preview,
			Width: f.Width, Height: f.Height,
		})
	}
	return out, nil
}

// UploadFileInput is a file from the frontend: filename + base64-encoded data.
type UploadFileInput struct {
	Filename string `json:"filename"`
	Data     string `json:"data"` // base64 (may include a data: URL prefix)
}

// SendFiles uploads one or more files (with optional text) to a channel.
func (a *App) SendFiles(channelID, content, nonce string, files []UploadFileInput) (MessageDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return MessageDTO{}, nil
	}

	uploads := make([]discord.UploadFile, 0, len(files))
	for _, f := range files {
		b64 := f.Data
		// Strip a data URL prefix if present (e.g. "data:image/png;base64,").
		if i := strings.Index(b64, ","); strings.HasPrefix(b64, "data:") && i >= 0 {
			b64 = b64[i+1:]
		}
		raw, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return MessageDTO{}, fmt.Errorf("decode %s: %w", f.Filename, err)
		}
		name := f.Filename
		if name == "" {
			name = "file"
		}
		uploads = append(uploads, discord.UploadFile{Filename: name, Data: raw})
	}

	m, err := rest.SendMessageWithFiles(channelID, content, nonce, uploads)
	if err != nil {
		return MessageDTO{}, err
	}
	return a.toMessageDTO(m), nil
}

// ---- Slash (application) commands -----------------------------------------

// CommandOptionDTO is a slash-command option/sub-command shaped for the UI.
type CommandOptionDTO struct {
	Type         int                `json:"type"`
	Name         string             `json:"name"`
	Description  string             `json:"description"`
	Required     bool               `json:"required"`
	Autocomplete bool               `json:"autocomplete"`
	Choices      []CommandChoiceDTO `json:"choices"`
	Options      []CommandOptionDTO `json:"options"`
}

// CommandChoiceDTO is a predefined choice for an option (value stringified).
type CommandChoiceDTO struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// CommandDTO is a bot slash command shaped for the UI picker.
type CommandDTO struct {
	ID          string             `json:"id"`
	AppID       string             `json:"appId"`
	Version     string             `json:"version"`
	Type        int                `json:"type"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	BotName     string             `json:"botName"`
	BotIconURL  string             `json:"botIconUrl"`
	Options     []CommandOptionDTO `json:"options"`
}

// CommandOptionInput is one filled-in option value sent from the frontend.
// Value is a string; the backend coerces it to the option's real type.
type CommandOptionInput struct {
	Type    int                  `json:"type"`
	Name    string               `json:"name"`
	Value   string               `json:"value"`
	Options []CommandOptionInput `json:"options"`
}

// CommandAttachmentInput is a file chosen for a slash command's attachment
// option: which option it's for, plus the filename and base64 data.
type CommandAttachmentInput struct {
	OptionName string `json:"optionName"`
	Filename   string `json:"filename"`
	Data       string `json:"data"` // base64 (may include a data: URL prefix)
}

func toCommandOptionDTO(o discord.CommandOption) CommandOptionDTO {
	choices := make([]CommandChoiceDTO, 0, len(o.Choices))
	for _, c := range o.Choices {
		choices = append(choices, CommandChoiceDTO{
			Name:  c.Name,
			Value: fmt.Sprintf("%v", c.Value),
		})
	}
	subs := make([]CommandOptionDTO, 0, len(o.Options))
	for _, s := range o.Options {
		subs = append(subs, toCommandOptionDTO(s))
	}
	return CommandOptionDTO{
		Type: o.Type, Name: o.Name, Description: o.Description,
		Required: o.Required, Autocomplete: o.Autocomplete,
		Choices: choices, Options: subs,
	}
}

// SearchCommands lists a channel's available slash commands (optionally filtered
// by query). Each command carries its owning bot's name/icon for the picker.
func (a *App) SearchCommands(guildID, channelID, query string) ([]CommandDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	res, err := rest.SearchCommands(guildID, channelID, query)
	if err != nil {
		return nil, err
	}
	// Map application id -> name/icon for display.
	appByID := make(map[string]discord.CommandApplication, len(res.Applications))
	for _, ap := range res.Applications {
		appByID[ap.ID] = ap
	}
	out := make([]CommandDTO, 0, len(res.Commands))
	for _, c := range res.Commands {
		opts := make([]CommandOptionDTO, 0, len(c.Options))
		for _, o := range c.Options {
			opts = append(opts, toCommandOptionDTO(o))
		}
		dto := CommandDTO{
			ID: c.ID, AppID: c.ApplicationID, Version: c.Version,
			Type: c.Type, Name: c.Name, Description: c.Description,
			Options: opts,
		}
		if ap, ok := appByID[c.ApplicationID]; ok {
			dto.BotName = ap.Name
			dto.BotIconURL = ap.IconURL()
		}
		out = append(out, dto)
	}
	return out, nil
}

// coerceOptionValue converts a string input to the JSON type Discord expects for
// the given option type (numbers/booleans must not be sent as strings).
func coerceOptionValue(optType int, raw string) any {
	switch optType {
	case discord.CmdOptInteger:
		var n int64
		if _, err := fmt.Sscanf(raw, "%d", &n); err == nil {
			return n
		}
		return raw
	case discord.CmdOptNumber:
		var f float64
		if _, err := fmt.Sscanf(raw, "%g", &f); err == nil {
			return f
		}
		return raw
	case discord.CmdOptBoolean:
		return raw == "true" || raw == "1"
	default:
		return raw
	}
}

// buildInteractionOptions converts frontend inputs into Discord interaction
// options, recursing into sub-commands/groups. Empty leaf values are dropped.
// attIndex maps an attachment option's name to its uploaded attachment index,
// which becomes that option's value.
func buildInteractionOptions(
	inputs []CommandOptionInput,
	attIndex map[string]string,
) []discord.InteractionOption {
	out := make([]discord.InteractionOption, 0, len(inputs))
	for _, in := range inputs {
		if in.Type == discord.CmdOptSubCommand || in.Type == discord.CmdOptSubCommandGroup {
			out = append(out, discord.InteractionOption{
				Type:    in.Type,
				Name:    in.Name,
				Options: buildInteractionOptions(in.Options, attIndex),
			})
			continue
		}
		// Attachment options carry their value as the uploaded attachment index.
		if in.Type == discord.CmdOptAttachment {
			idx, ok := attIndex[in.Name]
			if !ok {
				continue // no file provided for this attachment option
			}
			out = append(out, discord.InteractionOption{
				Type: in.Type, Name: in.Name, Value: idx,
			})
			continue
		}
		if in.Value == "" {
			continue // skip unfilled optional values
		}
		out = append(out, discord.InteractionOption{
			Type:  in.Type,
			Name:  in.Name,
			Value: coerceOptionValue(in.Type, in.Value),
		})
	}
	return out
}

// ExecuteCommand invokes a slash command via the /interactions endpoint. The
// command id/version come from the frontend (sourced from SearchCommands); the
// session id is pulled live from the gateway. attachments are files for any
// attachment options, uploaded first and referenced by index. The bot's reply
// arrives over the gateway as a normal message.
func (a *App) ExecuteCommand(
	guildID, channelID, commandID, appID, version, name string,
	cmdType int,
	options []CommandOptionInput,
	attachments []CommandAttachmentInput,
) error {
	a.mu.Lock()
	rest := a.rest
	gw := a.gateway
	a.mu.Unlock()
	if rest == nil {
		return fmt.Errorf("not connected")
	}
	sessionID := ""
	if gw != nil {
		sessionID = gw.SessionID()
	}
	if sessionID == "" {
		return fmt.Errorf("gateway not ready")
	}

	// Upload any attachment-option files first, then map option name -> index so
	// the matching option's value points at the uploaded attachment.
	var atts []discord.InteractionAttachment
	attIndexByOption := map[string]string{}
	if len(attachments) > 0 {
		uploads := make([]discord.UploadFile, 0, len(attachments))
		for _, at := range attachments {
			raw, err := decodeBase64Data(at.Data)
			if err != nil {
				return fmt.Errorf("decode %s: %w", at.Filename, err)
			}
			fname := at.Filename
			if fname == "" {
				fname = "file"
			}
			uploads = append(uploads, discord.UploadFile{Filename: fname, Data: raw})
		}
		var err error
		atts, err = rest.UploadCommandAttachments(channelID, uploads)
		if err != nil {
			return err
		}
		// uploads and attachments line up by order; atts[i].ID is the index.
		for i, at := range attachments {
			if i < len(atts) {
				attIndexByOption[at.OptionName] = atts[i].ID
			}
		}
	}

	cmd := discord.ApplicationCommand{
		ID: commandID, ApplicationID: appID, Version: version,
		Type: cmdType, Name: name,
	}
	nonce := generateNonce()
	return rest.ExecuteCommand(
		guildID, channelID, sessionID, nonce, cmd,
		buildInteractionOptions(options, attIndexByOption),
		atts,
	)
}

// decodeBase64Data decodes a base64 string, stripping a data: URL prefix.
func decodeBase64Data(b64 string) ([]byte, error) {
	if i := strings.Index(b64, ","); strings.HasPrefix(b64, "data:") && i >= 0 {
		b64 = b64[i+1:]
	}
	return base64.StdEncoding.DecodeString(b64)
}

// AutocompleteChoiceDTO is one suggestion for an autocomplete option.
type AutocompleteChoiceDTO struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Autocomplete fetches a bot's live suggestions for the focused option of a
// slash command. options carry the current (partial) values; focusedName is the
// option being typed. The request is fire-and-forget over HTTP; the bot's
// choices arrive over the gateway, correlated by nonce. We register a waiter,
// fire the request, and block (briefly) for the gateway response.
func (a *App) Autocomplete(
	guildID, channelID, commandID, appID, version, name string,
	cmdType int,
	options []CommandOptionInput,
	focusedName string,
) ([]AutocompleteChoiceDTO, error) {
	a.mu.Lock()
	rest := a.rest
	gw := a.gateway
	a.mu.Unlock()
	if rest == nil {
		return nil, fmt.Errorf("not connected")
	}
	sessionID := ""
	if gw != nil {
		sessionID = gw.SessionID()
	}
	if sessionID == "" {
		return nil, fmt.Errorf("gateway not ready")
	}
	cmd := discord.ApplicationCommand{
		ID: commandID, ApplicationID: appID, Version: version,
		Type: cmdType, Name: name,
	}
	opts := buildAutocompleteOptions(options)

	// Register a waiter for this nonce before firing the request, so we don't
	// race the gateway response.
	nonce := generateNonce()
	ch := make(chan []discord.AutocompleteChoice, 1)
	a.acMu.Lock()
	a.acWaiters[nonce] = ch
	a.acMu.Unlock()
	defer func() {
		a.acMu.Lock()
		delete(a.acWaiters, nonce)
		a.acMu.Unlock()
	}()

	if err := rest.Autocomplete(guildID, channelID, sessionID, nonce, cmd, opts, focusedName); err != nil {
		return nil, err
	}

	// Wait for the gateway dispatch (or time out — some bots are slow/silent).
	select {
	case choices := <-ch:
		out := make([]AutocompleteChoiceDTO, 0, len(choices))
		for _, c := range choices {
			out = append(out, AutocompleteChoiceDTO{
				Name:  c.Name,
				Value: fmt.Sprintf("%v", c.Value),
			})
		}
		return out, nil
	case <-time.After(3 * time.Second):
		return nil, nil // no response in time; treat as no suggestions
	}
}

// buildAutocompleteOptions is like buildInteractionOptions but keeps options
// with empty values (the focused option may be empty/partial) and ignores
// attachments (not relevant to autocomplete).
func buildAutocompleteOptions(inputs []CommandOptionInput) []discord.InteractionOption {
	out := make([]discord.InteractionOption, 0, len(inputs))
	for _, in := range inputs {
		if in.Type == discord.CmdOptSubCommand || in.Type == discord.CmdOptSubCommandGroup {
			out = append(out, discord.InteractionOption{
				Type:    in.Type,
				Name:    in.Name,
				Options: buildAutocompleteOptions(in.Options),
			})
			continue
		}
		opt := discord.InteractionOption{Type: in.Type, Name: in.Name}
		if in.Value != "" {
			opt.Value = coerceOptionValue(in.Type, in.Value)
		}
		out = append(out, opt)
	}
	return out
}

// generateNonce builds a Discord snowflake-like nonce from the current time.
// (Discord only requires uniqueness for dedup; exact epoch math isn't critical.)
func generateNonce() string {
	const discordEpoch = 1420070400000
	ms := time.Now().UnixMilli() - discordEpoch
	return fmt.Sprintf("%d", ms<<22)
}

func (a *App) SearchGifs(query string) ([]GifDTO, error) {
	a.mu.Lock()
	rest := a.rest
	a.mu.Unlock()
	if rest == nil {
		return nil, nil
	}
	gifs, err := rest.SearchGifs(query, 30)
	if err != nil {
		return nil, err
	}
	out := make([]GifDTO, 0, len(gifs))
	for _, g := range gifs {
		// Playable gif/mp4 url.
		url := g.URL
		if url == "" {
			url = g.Gif.Src
		}
		if url == "" {
			url = g.Src
		}
		// Static preview image.
		preview := g.Src
		if preview == "" {
			preview = g.Preview
		}
		if preview == "" {
			preview = url
		}
		w, h := g.Width, g.Height
		if w == 0 {
			w, h = g.Gif.Width, g.Gif.Height
		}
		out = append(out, GifDTO{
			ID: g.ID, URL: url, PreviewURL: preview, Width: w, Height: h,
		})
	}
	return out, nil
}

// ============================================================
// EventHandler implementation — pushes gateway events to the frontend
// ============================================================

func (a *App) emit(event string, data ...any) {
	if a.ctx == nil {
		return
	}
	wruntime.EventsEmit(a.ctx, event, data...)
}

func (a *App) OnReady(r *discord.Ready) {
	a.mu.Lock()
	self := r.User
	a.self = &self
	a.mu.Unlock()

	guilds := make([]GuildDTO, 0, len(r.Guilds))
	for _, g := range r.Guilds {
		guilds = append(guilds, GuildDTO{
			ID: g.ID, Name: g.Name, IconURL: g.IconURL(), Acronym: acronym(g.Name),
		})
	}
	// Order by the user's real sidebar order from settings; fall back to
	// alphabetical for any guilds not present in the order list.
	orderGuildsByIDs(guilds, r.UserSettings.OrderedGuildIDs())
	a.emit("cd:ready", map[string]any{
		"user":   toUserDTO(r.User),
		"guilds": guilds,
	})

	// Seed initial presences for friends/relationships.
	if r.MergedPresences != nil {
		seed := make(map[string]string)
		for _, p := range r.MergedPresences.Friends {
			uid := p.UserID
			if uid == "" && p.User != nil {
				uid = p.User.ID
			}
			if uid != "" && p.Status != "" {
				seed[uid] = p.Status
			}
		}
		if len(seed) > 0 {
			a.emit("cd:presenceBulk", seed)
		}
	}
}

func (a *App) OnMessageCreate(m *discord.Message) {
	a.emit("cd:message", a.toMessageDTO(m))
}

func (a *App) OnMessageUpdate(m *discord.Message) {
	a.emit("cd:messageUpdate", a.toMessageDTO(m))
}

func (a *App) OnMessageDelete(channelID, messageID string) {
	a.emit("cd:messageDelete", map[string]string{
		"channelId": channelID,
		"messageId": messageID,
	})
}

func (a *App) OnMemberListUpdate(guildID string, members []discord.User) {
	out := make([]UserDTO, 0, len(members))
	for _, u := range members {
		out = append(out, toUserDTO(u))
	}
	a.emit("cd:members", map[string]any{
		"guildId": guildID,
		"members": out,
	})
}

func (a *App) OnTypingStart(channelID, userID string) {
	a.emit("cd:typing", map[string]string{"channelId": channelID, "userId": userID})
}

func (a *App) OnPresenceUpdate(userID, status string) {
	a.emit("cd:presence", map[string]string{"userId": userID, "status": status})
}

func emojiToString(e discord.Emoji) string {
	if e.ID != "" {
		// Custom emoji: name:id (so the UI can build a CDN url).
		return e.Name + ":" + e.ID
	}
	return e.Name // unicode
}

func (a *App) OnReactionAdd(channelID, messageID, userID string, emoji discord.Emoji) {
	mine := false
	a.mu.Lock()
	if a.self != nil && userID == a.self.ID {
		mine = true
	}
	a.mu.Unlock()
	a.emit("cd:reactionAdd", map[string]any{
		"channelId": channelID, "messageId": messageID,
		"emoji": emojiToString(emoji), "mine": mine,
	})
}

func (a *App) OnReactionRemove(channelID, messageID, userID string, emoji discord.Emoji) {
	mine := false
	a.mu.Lock()
	if a.self != nil && userID == a.self.ID {
		mine = true
	}
	a.mu.Unlock()
	a.emit("cd:reactionRemove", map[string]any{
		"channelId": channelID, "messageId": messageID,
		"emoji": emojiToString(emoji), "mine": mine,
	})
}

func (a *App) OnError(err error) {
	a.emit("cd:error", err.Error())
}

func (a *App) OnStatus(status string) {
	a.emit("cd:status", status)
}

// OnAutocompleteResponse delivers a bot's autocomplete choices to the waiter
// registered for the request's nonce (see Autocomplete).
func (a *App) OnAutocompleteResponse(nonce string, choices []discord.AutocompleteChoice) {
	a.acMu.Lock()
	ch := a.acWaiters[nonce]
	a.acMu.Unlock()
	if ch != nil {
		select {
		case ch <- choices:
		default:
		}
	}
}
