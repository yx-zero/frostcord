package discord

// Subset of Discord's REST/Gateway models that we surface to the frontend.
// Field names follow Discord's JSON so we can unmarshal API responses directly.

type User struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Discriminator string `json:"discriminator"`
	Avatar        string `json:"avatar"`
	Bot           bool   `json:"bot"`
}

// AvatarURL builds the CDN url for a user's avatar (or empty if none).
func (u User) AvatarURL() string {
	if u.Avatar == "" {
		return ""
	}
	ext := "png"
	if len(u.Avatar) > 2 && u.Avatar[:2] == "a_" {
		ext = "gif"
	}
	return "https://cdn.discordapp.com/avatars/" + u.ID + "/" + u.Avatar + "." + ext + "?size=128"
}

// DisplayName prefers the global name, then username.
func (u User) DisplayName() string {
	if u.GlobalName != "" {
		return u.GlobalName
	}
	return u.Username
}

type Guild struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Icon     string    `json:"icon"`
	Channels []Channel `json:"channels"`
}

// IconURL builds the CDN url for a guild icon (or empty if none).
func (g Guild) IconURL() string {
	if g.Icon == "" {
		return ""
	}
	ext := "png"
	if len(g.Icon) > 2 && g.Icon[:2] == "a_" {
		ext = "gif"
	}
	return "https://cdn.discordapp.com/icons/" + g.ID + "/" + g.Icon + "." + ext + "?size=128"
}

// Channel types per Discord's API.
const (
	ChannelGuildText     = 0
	ChannelDM            = 1
	ChannelGuildVoice    = 2
	ChannelGroupDM       = 3
	ChannelGuildCategory = 4
	ChannelAnnouncement  = 5
)

type Channel struct {
	ID       string `json:"id"`
	GuildID  string `json:"guild_id"`
	Name     string `json:"name"`
	Type     int    `json:"type"`
	Topic    string `json:"topic"`
	Position int    `json:"position"`
	ParentID string `json:"parent_id"`
	// For DMs
	Recipients    []User `json:"recipients"`
	LastMessageID string `json:"last_message_id"`
	Icon          string `json:"icon"`
}

type Attachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	URL         string `json:"url"`
	ContentType string `json:"content_type"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
}

type Emoji struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Animated bool   `json:"animated"`
}

type Reaction struct {
	Count int   `json:"count"`
	Me    bool  `json:"me"`
	Emoji Emoji `json:"emoji"`
}

type MessageReference struct {
	MessageID string `json:"message_id"`
	ChannelID string `json:"channel_id"`
	GuildID   string `json:"guild_id"`
}

type Message struct {
	ID                string            `json:"id"`
	ChannelID         string            `json:"channel_id"`
	GuildID           string            `json:"guild_id"`
	Author            User              `json:"author"`
	Content           string            `json:"content"`
	Timestamp         string            `json:"timestamp"`
	EditedTimestamp   string            `json:"edited_timestamp"`
	Attachments       []Attachment      `json:"attachments"`
	Embeds            []Embed           `json:"embeds"`
	Reactions         []Reaction        `json:"reactions"`
	Mentions          []User            `json:"mentions"`
	MentionRoles      []string          `json:"mention_roles"`
	Nonce             string            `json:"nonce"`
	Type              int               `json:"type"`
	MessageReference  *MessageReference `json:"message_reference"`
	ReferencedMessage *Message          `json:"referenced_message"`
	Components        []Component       `json:"components"`
	Poll              *Poll             `json:"poll"`
}

// Component covers message action rows + buttons + select menus (bot UI).
type Component struct {
	Type       int         `json:"type"` // 1=action row, 2=button, 3=select
	Components []Component `json:"components"`
	// button fields
	Style    int    `json:"style"`
	Label    string `json:"label"`
	CustomID string `json:"custom_id"`
	URL      string `json:"url"`
	Disabled bool   `json:"disabled"`
	Emoji    *Emoji `json:"emoji"`
	// select menu
	Placeholder string `json:"placeholder"`
}

// Poll covers a message poll.
type Poll struct {
	Question         PollQuestion `json:"question"`
	Answers          []PollAnswer `json:"answers"`
	Expiry           string       `json:"expiry"`
	Results          *PollResults `json:"results"`
	AllowMultiselect bool         `json:"allow_multiselect"`
}

type PollQuestion struct {
	Text string `json:"text"`
}

type PollResults struct {
	IsFinalized  bool              `json:"is_finalized"`
	AnswerCounts []PollAnswerCount `json:"answer_counts"`
}

type PollAnswerCount struct {
	ID      int  `json:"id"`
	Count   int  `json:"count"`
	MeVoted bool `json:"me_voted"`
}

type PollAnswer struct {
	AnswerID  int            `json:"answer_id"`
	PollMedia PollMedia      `json:"poll_media"`
}

type PollMedia struct {
	Text  string `json:"text"`
	Emoji *Emoji `json:"emoji"`
}

// Embed covers the rich-embed structure we render.
type Embed struct {
	Type        string         `json:"type"`
	URL         string         `json:"url"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Color       int            `json:"color"`
	Timestamp   string         `json:"timestamp"`
	Thumbnail   *EmbedMedia    `json:"thumbnail"`
	Image       *EmbedMedia    `json:"image"`
	Video       *EmbedMedia    `json:"video"`
	Author      *EmbedAuthor   `json:"author"`
	Footer      *EmbedFooter   `json:"footer"`
	Provider    *EmbedProvider `json:"provider"`
	Fields      []EmbedField   `json:"fields"`
}

type EmbedAuthor struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	IconURL string `json:"icon_url"`
}

type EmbedFooter struct {
	Text    string `json:"text"`
	IconURL string `json:"icon_url"`
}

type EmbedProvider struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type EmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type EmbedMedia struct {
	URL      string `json:"url"`
	ProxyURL string `json:"proxy_url"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

// ---- Gateway READY payload subset ----------------------------------------

type ReadyUser = User

type Ready struct {
	User             User      `json:"user"`
	SessionID        string    `json:"session_id"`
	ResumeGatewayURL string    `json:"resume_gateway_url"`
	Guilds           []Guild   `json:"guilds"`
	PrivateChannels  []Channel `json:"private_channels"`
	// Legacy user settings carry the sidebar guild order for user accounts.
	UserSettings *UserSettings `json:"user_settings"`
	// Initial presences of friends/relationships.
	MergedPresences *MergedPresences `json:"merged_presences"`
}

type MergedPresences struct {
	Friends []PresenceEntry `json:"friends"`
}

type PresenceEntry struct {
	UserID string `json:"user_id"`
	User   *User  `json:"user"`
	Status string `json:"status"`
}

type UserSettings struct {
	// Flat sidebar order of guild ids (top-level), legacy but still sent.
	GuildPositions []string `json:"guild_positions"`
	// Folders define the grouped/ordered sidebar; each folder lists guild ids.
	GuildFolders []GuildFolder `json:"guild_folders"`
}

type GuildFolder struct {
	GuildIDs []string `json:"guild_ids"`
	ID       any      `json:"id"`
	Name     string   `json:"name"`
}

// OrderedGuildIDs returns the user's sidebar guild order, preferring folders
// (which reflect the real client order), then guild_positions.
func (s *UserSettings) OrderedGuildIDs() []string {
	if s == nil {
		return nil
	}
	if len(s.GuildFolders) > 0 {
		out := make([]string, 0)
		for _, f := range s.GuildFolders {
			out = append(out, f.GuildIDs...)
		}
		if len(out) > 0 {
			return out
		}
	}
	return s.GuildPositions
}

// ---- User profile --------------------------------------------------------

// ProfileUser is the richer user object returned by the profile endpoint.
type ProfileUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Discriminator string `json:"discriminator"`
	Avatar        string `json:"avatar"`
	Banner        string `json:"banner"`
	AccentColor   *int   `json:"accent_color"`
	Bio           string `json:"bio"`
	Pronouns      string `json:"pronouns"`
	Bot           bool   `json:"bot"`
}

type ProfileMeta struct {
	Bio         string `json:"bio"`
	Banner      string `json:"banner"`
	AccentColor *int   `json:"accent_color"`
	Pronouns    string `json:"pronouns"`
	ThemeColors []int  `json:"theme_colors"`
}

type ProfileBadge struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Link        string `json:"link"`
}

type UserProfile struct {
	User        ProfileUser    `json:"user"`
	UserProfile ProfileMeta    `json:"user_profile"`
	Badges      []ProfileBadge `json:"badges"`
}

// BannerURL builds the CDN url for the profile banner (or empty).
func (p UserProfile) BannerURL() string {
	banner := p.User.Banner
	if banner == "" {
		banner = p.UserProfile.Banner
	}
	if banner == "" {
		return ""
	}
	ext := "png"
	if len(banner) > 2 && banner[:2] == "a_" {
		ext = "gif"
	}
	return "https://cdn.discordapp.com/banners/" + p.User.ID + "/" + banner + "." + ext + "?size=600"
}

// AvatarURL builds the avatar url for the profile user.
func (p UserProfile) AvatarURL() string {
	if p.User.Avatar == "" {
		return ""
	}
	ext := "png"
	if len(p.User.Avatar) > 2 && p.User.Avatar[:2] == "a_" {
		ext = "gif"
	}
	return "https://cdn.discordapp.com/avatars/" + p.User.ID + "/" + p.User.Avatar + "." + ext + "?size=240"
}
