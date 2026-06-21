package discord

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

const (
	apiBase = "https://discord.com/api/v9"
	// Spoof the official Discord DESKTOP (Electron) client.
	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
		"(KHTML, like Gecko) discord/1.0.9242 Chrome/136.0.0.0 Electron/34.2.0 Safari/537.36"
	clientBuildNumber = 396858
	clientVersion     = "1.0.9242"
	nativeBuildNumber = 61250
)

// superProperties mirrors the official Discord DESKTOP client's
// X-Super-Properties payload. Matching the UA exactly reduces flagging.
func superProperties() string {
	props := map[string]any{
		"os":                  "Windows",
		"browser":             "Discord Client",
		"release_channel":     "stable",
		"client_version":      clientVersion,
		"os_version":          "10.0.26100",
		"os_arch":             "x64",
		"app_arch":            "x64",
		"system_locale":       "en-US",
		"browser_user_agent":  userAgent,
		"browser_version":     "34.2.0",
		"client_build_number": clientBuildNumber,
		"native_build_number": nativeBuildNumber,
		"client_event_source": nil,
		"has_client_mods":     false,
	}
	b, _ := json.Marshal(props)
	return base64.StdEncoding.EncodeToString(b)
}

// REST is a thin Discord HTTP client authenticated with a user token.
type REST struct {
	token  string
	http   *http.Client
	xprops string
}

func NewREST(token string) *REST {
	return &REST{
		token:  token,
		http:   &http.Client{Timeout: 30 * time.Second},
		xprops: superProperties(),
	}
}

func (r *REST) Token() string { return r.token }

// do issues an authenticated request and decodes JSON into out (if non-nil).
func (r *REST) do(method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, apiBase+path, reader)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", r.token)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Super-Properties", r.xprops)
	req.Header.Set("X-Discord-Locale", "en-US")
	req.Header.Set("X-Debug-Options", "bugReporterEnabled")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Origin", "https://discord.com")
	req.Header.Set("Referer", "https://discord.com/channels/@me")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		// Basic rate-limit handling: respect retry_after and try once more.
		var rl struct {
			RetryAfter float64 `json:"retry_after"`
		}
		_ = json.Unmarshal(data, &rl)
		wait := time.Duration(rl.RetryAfter*1000) * time.Millisecond
		if wait <= 0 || wait > 10*time.Second {
			wait = time.Second
		}
		time.Sleep(wait)
		return r.do(method, path, body, out)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord %s %s: %d %s", method, path, resp.StatusCode, string(data))
	}

	if out != nil && len(data) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("decode %s: %w", path, err)
		}
	}
	return nil
}

// CurrentUser fetches @me — used to validate the token on login.
func (r *REST) CurrentUser() (*User, error) {
	var u User
	if err := r.do(http.MethodGet, "/users/@me", nil, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// UserProfile fetches a user's full profile (banner, bio, pronouns, badges).
func (r *REST) UserProfile(userID string) (*UserProfile, error) {
	var p UserProfile
	path := "/users/" + userID + "/profile?with_mutual_guilds=false"
	if err := r.do(http.MethodGet, path, nil, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// Guilds lists the user's guilds (lightweight, no channels).
func (r *REST) Guilds() ([]Guild, error) {
	var gs []Guild
	if err := r.do(http.MethodGet, "/users/@me/guilds", nil, &gs); err != nil {
		return nil, err
	}
	return gs, nil
}

// GuildChannels lists channels for a guild.
func (r *REST) GuildChannels(guildID string) ([]Channel, error) {
	var cs []Channel
	if err := r.do(http.MethodGet, "/guilds/"+guildID+"/channels", nil, &cs); err != nil {
		return nil, err
	}
	return cs, nil
}

// GuildRoles lists the roles defined in a guild.
func (r *REST) GuildRoles(guildID string) ([]Role, error) {
	var rs []Role
	if err := r.do(http.MethodGet, "/guilds/"+guildID+"/roles", nil, &rs); err != nil {
		return nil, err
	}
	return rs, nil
}

// DMChannels lists the user's private (DM/group) channels.
func (r *REST) DMChannels() ([]Channel, error) {
	var cs []Channel
	if err := r.do(http.MethodGet, "/users/@me/channels", nil, &cs); err != nil {
		return nil, err
	}
	return cs, nil
}

// AcceptMessageRequest consents to a DM message request (consent_status=2),
// moving it out of the requests inbox into normal DMs.
func (r *REST) AcceptMessageRequest(channelID string) error {
	body := map[string]any{"consent_status": 2}
	return r.do(http.MethodPut, "/channels/"+channelID+"/recipients/@me", body, nil)
}

// DeclineMessageRequest rejects (and removes) a DM message request.
func (r *REST) DeclineMessageRequest(channelID string) error {
	return r.do(http.MethodDelete, "/channels/"+channelID+"/recipients/@me", nil, nil)
}

// MessageRequestSupplemental carries the preview (sender + first message) shown
// for a pending message request.
type MessageRequestSupplemental struct {
	ChannelID      string   `json:"channel_id"`
	MessagePreview *Message `json:"message_preview"`
}

// MessageRequestSupplementalData resolves sender + preview for message-request
// channels (READY only carries the ids/flags, not recipient details). Max 25 ids.
func (r *REST) MessageRequestSupplementalData(channelIDs []string) ([]MessageRequestSupplemental, error) {
	if len(channelIDs) == 0 {
		return nil, nil
	}
	q := ""
	for i, id := range channelIDs {
		if i > 0 {
			q += "&"
		}
		q += "channel_ids=" + id
	}
	var out []MessageRequestSupplemental
	if err := r.do(http.MethodGet, "/users/@me/message-requests/supplemental-data?"+q, nil, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Channel fetches a single channel (used as a fallback to resolve a message
// request's recipient when no preview is available).
func (r *REST) Channel(id string) (*Channel, error) {
	var c Channel
	if err := r.do(http.MethodGet, "/channels/"+id, nil, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

// Messages fetches recent messages for a channel (most recent first).
func (r *REST) Messages(channelID string, limit int) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var ms []Message
	path := fmt.Sprintf("/channels/%s/messages?limit=%d", channelID, limit)
	if err := r.do(http.MethodGet, path, nil, &ms); err != nil {
		return nil, err
	}
	return ms, nil
}

// MessagesBefore fetches older messages before a given message id (pagination).
func (r *REST) MessagesBefore(channelID, beforeID string, limit int) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var ms []Message
	path := fmt.Sprintf("/channels/%s/messages?limit=%d&before=%s", channelID, limit, beforeID)
	if err := r.do(http.MethodGet, path, nil, &ms); err != nil {
		return nil, err
	}
	return ms, nil
}

// EditMessage edits the content of one of the user's own messages.
func (r *REST) EditMessage(channelID, messageID, content string) (*Message, error) {
	body := map[string]any{"content": content}
	var m Message
	path := "/channels/" + channelID + "/messages/" + messageID
	if err := r.do(http.MethodPatch, path, body, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// AddReaction / RemoveReaction toggle the user's own reaction. emoji is either a
// unicode char or "name:id" for a custom emoji.
func (r *REST) AddReaction(channelID, messageID, emoji string) error {
	e := urlEncode(emoji)
	path := "/channels/" + channelID + "/messages/" + messageID + "/reactions/" + e + "/@me"
	return r.do(http.MethodPut, path, nil, nil)
}

func (r *REST) RemoveReaction(channelID, messageID, emoji string) error {
	e := urlEncode(emoji)
	path := "/channels/" + channelID + "/messages/" + messageID + "/reactions/" + e + "/@me"
	return r.do(http.MethodDelete, path, nil, nil)
}

// Relationship is a friend / pending / blocked entry.
type Relationship struct {
	ID   string `json:"id"`
	Type int    `json:"type"` // 1=friend, 2=blocked, 3=incoming, 4=outgoing
	User User   `json:"user"`
	Nick string `json:"nickname"`
}

// Relationships lists the user's friends / pending / blocked.
func (r *REST) Relationships() ([]Relationship, error) {
	var rels []Relationship
	if err := r.do(http.MethodGet, "/users/@me/relationships", nil, &rels); err != nil {
		return nil, err
	}
	return rels, nil
}

// RemoveRelationship deletes a friend / declines a request.
func (r *REST) RemoveRelationship(userID string) error {
	return r.do(http.MethodDelete, "/users/@me/relationships/"+userID, nil, nil)
}

// AcceptRelationship accepts an incoming friend request.
func (r *REST) AcceptRelationship(userID string) error {
	return r.do(http.MethodPut, "/users/@me/relationships/"+userID, map[string]any{}, nil)
}

// VotePoll casts the user's vote on a poll message.
func (r *REST) VotePoll(channelID, messageID string, answerIDs []int) error {
	body := map[string]any{"answer_ids": answerIDs}
	path := fmt.Sprintf("/channels/%s/polls/%s/answers/@me", channelID, messageID)
	return r.do(http.MethodPut, path, body, nil)
}

// PinnedMessages fetches the pinned messages for a channel.
func (r *REST) PinnedMessages(channelID string) ([]Message, error) {
	var ms []Message
	if err := r.do(http.MethodGet, "/channels/"+channelID+"/pins", nil, &ms); err != nil {
		return nil, err
	}
	return ms, nil
}

// SearchGuildMembers returns guild members (including offline) via the search
// endpoint, which user accounts can use. An empty query returns members up to
// the limit. Discord may need a moment to index a guild on first search.
func (r *REST) SearchGuildMembers(guildID, query string, limit int) ([]User, error) {
	if limit <= 0 || limit > 1000 {
		limit = 1000
	}
	body := map[string]any{
		"limit": limit,
		"sort":  1, // JOINED_AT_DESC
	}
	if query != "" {
		body["and_query"] = map[string]any{
			"names": map[string]any{"and_query": []string{query}},
		}
	}
	var resp struct {
		GuildID string `json:"guild_id"`
		Members []struct {
			Member struct {
				User User `json:"user"`
			} `json:"member"`
		} `json:"members"`
	}
	if err := r.do(http.MethodPost, "/guilds/"+guildID+"/members-search", body, &resp); err != nil {
		return nil, err
	}
	out := make([]User, 0, len(resp.Members))
	for _, m := range resp.Members {
		out = append(out, m.Member.User)
	}
	return out, nil
}

// SendMessage posts a text message with an optional nonce and reply reference.
func (r *REST) SendMessage(channelID, content, nonce, replyToID string) (*Message, error) {
	body := map[string]any{
		"content": content,
		"tts":     false,
	}
	if nonce != "" {
		body["nonce"] = nonce
	}
	if replyToID != "" {
		body["message_reference"] = map[string]any{
			"message_id": replyToID,
			"channel_id": channelID,
		}
		// Don't ping the replied-to author by default (matches a plain reply).
		body["allowed_mentions"] = map[string]any{"replied_user": false}
	}
	var m Message
	if err := r.do(http.MethodPost, "/channels/"+channelID+"/messages", body, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// DeleteMessage permanently deletes a message via REST.
func (r *REST) DeleteMessage(channelID, messageID string) error {
	return r.do(http.MethodDelete, "/channels/"+channelID+"/messages/"+messageID, nil, nil)
}

// UploadFile is one attachment to send via multipart.
type UploadFile struct {
	Filename string
	Data     []byte
}

// SendMessageWithFiles posts a message with file attachments using multipart
// form-data, matching the Discord web client's upload request shape.
func (r *REST) SendMessageWithFiles(channelID, content, nonce string, files []UploadFile) (*Message, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	// payload_json carries the message content + attachment metadata.
	attachMeta := make([]map[string]any, 0, len(files))
	for i, f := range files {
		attachMeta = append(attachMeta, map[string]any{
			"id":       i,
			"filename": f.Filename,
		})
	}
	payload := map[string]any{
		"content":     content,
		"tts":         false,
		"attachments": attachMeta,
	}
	if nonce != "" {
		payload["nonce"] = nonce
	}
	pj, _ := json.Marshal(payload)
	if err := mw.WriteField("payload_json", string(pj)); err != nil {
		return nil, err
	}

	for i, f := range files {
		part, err := mw.CreateFormFile(fmt.Sprintf("files[%d]", i), f.Filename)
		if err != nil {
			return nil, err
		}
		if _, err := part.Write(f.Data); err != nil {
			return nil, err
		}
	}
	if err := mw.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost,
		apiBase+"/channels/"+channelID+"/messages", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", r.token)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Super-Properties", r.xprops)
	req.Header.Set("X-Discord-Locale", "en-US")
	req.Header.Set("Origin", "https://discord.com")
	req.Header.Set("Referer", "https://discord.com/channels/@me")
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upload failed: %d %s", resp.StatusCode, string(data))
	}
	var m Message
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// SearchCommands lists the slash commands available in a channel/guild via the
// application-command-index endpoint (the documented mechanism the official
// client uses). For guild channels it queries the guild index; for DMs it falls
// back to the channel index. The optional query filters by command name prefix
// client-side. Returns the index's applications + commands.
func (r *REST) SearchCommands(guildID, channelID, query string) (*CommandSearchResult, error) {
	var path string
	if guildID != "" && guildID != "@me" {
		path = "/guilds/" + guildID + "/application-command-index"
	} else {
		path = "/channels/" + channelID + "/application-command-index"
	}
	var res CommandSearchResult
	if err := r.do(http.MethodGet, path, nil, &res); err != nil {
		return nil, err
	}
	// Keep only CHAT_INPUT (slash) commands, and filter by the query prefix.
	q := strings.ToLower(query)
	filtered := make([]ApplicationCommand, 0, len(res.Commands))
	for _, c := range res.Commands {
		if c.Type != 0 && c.Type != CmdTypeChatInput {
			continue // skip user/message context-menu commands
		}
		if q != "" && !strings.HasPrefix(strings.ToLower(c.Name), q) {
			continue
		}
		filtered = append(filtered, c)
	}
	res.Commands = filtered
	return &res, nil
}

// InteractionAttachment is a pre-uploaded file referenced by a slash command's
// attachment option. ID is the per-interaction index ("0", "1", ...).
type InteractionAttachment struct {
	ID               string // index matching the option value
	Filename         string
	UploadedFilename string // returned by RequestAttachmentUploads
}

// uploadSlot is one entry from the POST /channels/{id}/attachments response.
type uploadSlot struct {
	ID             int    `json:"id"`
	UploadURL      string `json:"upload_url"`
	UploadFilename string `json:"upload_filename"`
}

// RequestAttachmentUploads reserves upload slots for the given files and returns
// signed upload URLs. This is step 1 of Discord's pre-upload flow.
func (r *REST) RequestAttachmentUploads(channelID string, files []UploadFile) ([]uploadSlot, error) {
	reqFiles := make([]map[string]any, 0, len(files))
	for i, f := range files {
		reqFiles = append(reqFiles, map[string]any{
			"id":        i,
			"filename":  f.Filename,
			"file_size": len(f.Data),
		})
	}
	body := map[string]any{"files": reqFiles}
	var resp struct {
		Attachments []uploadSlot `json:"attachments"`
	}
	if err := r.do(http.MethodPost, "/channels/"+channelID+"/attachments", body, &resp); err != nil {
		return nil, err
	}
	return resp.Attachments, nil
}

// uploadToURL PUTs raw bytes to a signed upload URL (step 2). No auth header —
// the URL is pre-signed.
func (r *REST) uploadToURL(url string, data []byte) error {
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	resp, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload PUT failed: %d %s", resp.StatusCode, string(b))
	}
	return nil
}

// UploadCommandAttachments runs the full pre-upload flow for files used in a
// slash command's attachment options, returning references to embed in the
// interaction's data.attachments array.
func (r *REST) UploadCommandAttachments(channelID string, files []UploadFile) ([]InteractionAttachment, error) {
	if len(files) == 0 {
		return nil, nil
	}
	slots, err := r.RequestAttachmentUploads(channelID, files)
	if err != nil {
		return nil, err
	}
	out := make([]InteractionAttachment, 0, len(slots))
	for _, s := range slots {
		if s.ID < 0 || s.ID >= len(files) {
			continue
		}
		if err := r.uploadToURL(s.UploadURL, files[s.ID].Data); err != nil {
			return nil, err
		}
		out = append(out, InteractionAttachment{
			ID:               fmt.Sprintf("%d", s.ID),
			Filename:         files[s.ID].Filename,
			UploadedFilename: s.UploadFilename,
		})
	}
	return out, nil
}

// AutocompleteChoice is one suggestion returned for an autocomplete option.
type AutocompleteChoice struct {
	Name  string `json:"name"`
	Value any    `json:"value"`
}

// Autocomplete fires a type-4 (APPLICATION_COMMAND_AUTOCOMPLETE) interaction for
// the focused option. This is fire-and-forget: Discord ACKs with 204 and the
// bot's choices arrive asynchronously over the gateway as an
// APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE dispatch, correlated by nonce. The
// caller must listen for that dispatch (matching the nonce it passed in).
// focusedName is the option being typed; options should mirror the command's
// real structure (sub-command nesting + correct option types).
func (r *REST) Autocomplete(
	guildID, channelID, sessionID, nonce string,
	cmd ApplicationCommand,
	options []InteractionOption,
	focusedName string,
) error {
	if options == nil {
		options = []InteractionOption{}
	}
	// Recursively serialize options, marking the focused one (at any nesting
	// level) so Discord/the bot knows which option to complete.
	var toRaw func(opts []InteractionOption) []map[string]any
	toRaw = func(opts []InteractionOption) []map[string]any {
		raw := make([]map[string]any, 0, len(opts))
		for _, o := range opts {
			m := map[string]any{"type": o.Type, "name": o.Name}
			if len(o.Options) > 0 {
				m["options"] = toRaw(o.Options)
			} else {
				if o.Value != nil {
					m["value"] = o.Value
				}
				if o.Name == focusedName {
					m["focused"] = true
				}
			}
			raw = append(raw, m)
		}
		return raw
	}
	rawOpts := toRaw(options)
	data := map[string]any{
		"version": cmd.Version,
		"id":      cmd.ID,
		"name":    cmd.Name,
		"type":    cmd.Type,
		"options": rawOpts,
	}
	body := map[string]any{
		"type":           4, // APPLICATION_COMMAND_AUTOCOMPLETE
		"application_id": cmd.ApplicationID,
		"channel_id":     channelID,
		"session_id":     sessionID,
		"nonce":          nonce,
		"data":           data,
	}
	if guildID != "" && guildID != "@me" {
		body["guild_id"] = guildID
	}
	// 204 No Content on success; choices come via the gateway.
	return r.do(http.MethodPost, "/interactions", body, nil)
}

// ExecuteCommand invokes a slash command by POSTing an APPLICATION_COMMAND
// interaction (type 2). guildID may be empty for DMs. sessionID must be the live
// gateway session id; nonce should be a fresh snowflake-like value. attachments
// are pre-uploaded files referenced by attachment options. The bot's reply
// arrives asynchronously over the gateway (MESSAGE_CREATE), not here.
func (r *REST) ExecuteCommand(
	guildID, channelID, sessionID, nonce string,
	cmd ApplicationCommand,
	options []InteractionOption,
	attachments []InteractionAttachment,
) error {
	if options == nil {
		options = []InteractionOption{}
	}
	attMeta := make([]map[string]any, 0, len(attachments))
	for _, a := range attachments {
		attMeta = append(attMeta, map[string]any{
			"id":                a.ID,
			"filename":          a.Filename,
			"uploaded_filename": a.UploadedFilename,
		})
	}
	data := map[string]any{
		"version":     cmd.Version,
		"id":          cmd.ID,
		"name":        cmd.Name,
		"type":        cmd.Type,
		"options":     options,
		"attachments": attMeta,
		// Newer clients echo the full command object back for server-side
		// validation; include it to match the official request shape.
		"application_command": map[string]any{
			"id":             cmd.ID,
			"application_id": cmd.ApplicationID,
			"version":        cmd.Version,
			"type":           cmd.Type,
			"name":           cmd.Name,
			"description":    cmd.Description,
			"options":        cmd.Options,
			"dm_permission":  true,
			"contexts":       nil,
		},
	}
	body := map[string]any{
		"type":               2, // APPLICATION_COMMAND
		"application_id":     cmd.ApplicationID,
		"channel_id":         channelID,
		"session_id":         sessionID,
		"nonce":              nonce,
		"data":               data,
		"analytics_location": "slash_ui",
	}
	if guildID != "" && guildID != "@me" {
		body["guild_id"] = guildID
	}
	// /interactions returns 204 No Content on success; errors carry a JSON body.
	return r.do(http.MethodPost, "/interactions", body, nil)
}

// SearchGifs queries Discord's Tenor proxy for GIFs.
func (r *REST) SearchGifs(query string, limit int) ([]TenorGif, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	if query == "" {
		// Trending returns an object: { categories: [...], gifs: [...] }.
		var resp struct {
			Gifs []TenorGif `json:"gifs"`
		}
		path := fmt.Sprintf("/gifs/trending?limit=%d&media_format=gif&locale=en-US", limit)
		if err := r.do(http.MethodGet, path, nil, &resp); err != nil {
			return nil, err
		}
		return resp.Gifs, nil
	}
	// Search returns a flat array of gifs.
	path := fmt.Sprintf("/gifs/search?q=%s&limit=%d&media_format=gif&locale=en-US",
		urlEncode(query), limit)
	var gifs []TenorGif
	if err := r.do(http.MethodGet, path, nil, &gifs); err != nil {
		return nil, err
	}
	return gifs, nil
}

type TenorGif struct {
	ID  string `json:"id"`
	Src string `json:"src"` // static preview image
	URL string `json:"url"` // playable gif/mp4
	Gif struct {
		Src    string `json:"src"`
		Width  int    `json:"width"`
		Height int    `json:"height"`
	} `json:"gif"`
	// Discord returns "preview" as a plain URL string.
	Preview string `json:"preview"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
}

func urlEncode(s string) string {
	// Minimal query escaping for the Tenor search term.
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~' {
			out = append(out, c)
		} else {
			out = append(out, '%')
			out = append(out, "0123456789ABCDEF"[c>>4])
			out = append(out, "0123456789ABCDEF"[c&15])
		}
	}
	return string(out)
}
