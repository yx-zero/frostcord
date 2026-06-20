package discord

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Gateway opcodes (https://discord.com/developers/docs/topics/gateway)
const (
	opDispatch           = 0
	opHeartbeat          = 1
	opIdentify           = 2
	opResume             = 6
	opReconnect          = 7
	opInvalidSession     = 9
	opHello              = 10
	opHeartbeatACK       = 11
	opGuildSubscriptions = 14 // lazy guild member-list request (user accounts)
)

const gatewayURL = "wss://gateway.discord.gg/?v=9&encoding=json"

// gatewayPayload is the envelope for all gateway frames.
type gatewayPayload struct {
	Op int             `json:"op"`
	D  json.RawMessage `json:"d"`
	S  *int            `json:"s"`
	T  string          `json:"t"`
}

// EventHandler receives decoded dispatch events from the gateway.
type EventHandler interface {
	OnReady(r *Ready)
	OnMessageCreate(m *Message)
	OnMessageUpdate(m *Message)
	OnMessageDelete(channelID, messageID string)
	OnMemberListUpdate(guildID string, members []User)
	OnTypingStart(channelID, userID string)
	OnPresenceUpdate(userID, status string)
	OnReactionAdd(channelID, messageID, userID string, emoji Emoji)
	OnReactionRemove(channelID, messageID, userID string, emoji Emoji)
	OnAutocompleteResponse(nonce string, choices []AutocompleteChoice)
	OnError(err error)
	OnStatus(status string)
}

// Gateway is a Discord user-account websocket client.
type Gateway struct {
	token   string
	xprops  string
	handler EventHandler

	mu        sync.Mutex
	conn      *websocket.Conn
	seq       *int
	sessionID string
	resumeURL string

	heartbeatInterval time.Duration
	stopCh            chan struct{}
	closed            bool
}

func NewGateway(token string, handler EventHandler) *Gateway {
	return &Gateway{
		token:   token,
		xprops:  superProperties(),
		handler: handler,
		stopCh:  make(chan struct{}),
	}
}

// Connect dials the gateway and runs the read loop until Close is called.
// It auto-reconnects (with resume when possible) on transient failures.
func (g *Gateway) Connect() {
	for {
		select {
		case <-g.stopCh:
			return
		default:
		}

		err := g.runOnce()

		g.mu.Lock()
		closed := g.closed
		g.mu.Unlock()
		if closed {
			// Intentional shutdown — the read error is expected, don't report it.
			return
		}

		if err != nil {
			g.handler.OnError(fmt.Errorf("gateway: %w", err))
		}

		g.handler.OnStatus("reconnecting")
		time.Sleep(2 * time.Second)
	}
}

// runOnce establishes a single connection lifecycle.
func (g *Gateway) runOnce() error {
	dialURL := gatewayURL
	canResume := false
	g.mu.Lock()
	if g.sessionID != "" && g.resumeURL != "" {
		dialURL = g.resumeURL + "/?v=9&encoding=json"
		canResume = true
	}
	g.mu.Unlock()

	conn, _, err := websocket.DefaultDialer.Dial(dialURL, nil)
	if err != nil {
		return err
	}
	g.mu.Lock()
	g.conn = conn
	g.mu.Unlock()
	defer conn.Close()

	g.handler.OnStatus("connecting")

	// First frame should be HELLO.
	var hello gatewayPayload
	if err := conn.ReadJSON(&hello); err != nil {
		return err
	}
	if hello.Op != opHello {
		return fmt.Errorf("expected HELLO, got op %d", hello.Op)
	}
	var helloData struct {
		HeartbeatInterval int `json:"heartbeat_interval"`
	}
	if err := json.Unmarshal(hello.D, &helloData); err != nil {
		return err
	}
	g.heartbeatInterval = time.Duration(helloData.HeartbeatInterval) * time.Millisecond

	// IDENTIFY (or RESUME if we have a session).
	if canResume {
		if err := g.sendResume(); err != nil {
			return err
		}
	} else {
		if err := g.sendIdentify(); err != nil {
			return err
		}
	}

	// Heartbeat loop.
	hbStop := make(chan struct{})
	go g.heartbeatLoop(conn, hbStop)
	defer close(hbStop)

	// Read loop.
	for {
		select {
		case <-g.stopCh:
			return nil
		default:
		}

		var p gatewayPayload
		if err := conn.ReadJSON(&p); err != nil {
			return err
		}
		if p.S != nil {
			g.mu.Lock()
			g.seq = p.S
			g.mu.Unlock()
		}

		switch p.Op {
		case opDispatch:
			g.handleDispatch(p)
		case opHeartbeat:
			_ = g.sendHeartbeat(conn)
		case opReconnect:
			// Server asks us to reconnect; resume on next loop.
			return fmt.Errorf("server requested reconnect")
		case opInvalidSession:
			// Session invalid; drop it so we re-identify fresh.
			g.mu.Lock()
			g.sessionID = ""
			g.resumeURL = ""
			g.mu.Unlock()
			return fmt.Errorf("invalid session")
		case opHeartbeatACK:
			// ack received; nothing to do
		}
	}
}

// SessionID returns the current gateway session id (set after READY). Empty
// until the connection is ready. Required to invoke application commands, since
// the /interactions endpoint expects the live gateway session id.
func (g *Gateway) SessionID() string {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.sessionID
}

func (g *Gateway) sendIdentify() error {
	// User-client IDENTIFY: token has no "Bot " prefix, properties mimic the
	// web client, no intents (users default to all events).
	identify := map[string]any{
		"op": opIdentify,
		"d": map[string]any{
			"token":        g.token,
			"capabilities": 16381,
			"properties": map[string]any{
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
			},
			"presence": map[string]any{
				"status":     "online",
				"since":      0,
				"activities": []any{},
				"afk":        false,
			},
			"compress": false,
			"client_state": map[string]any{
				"guild_versions": map[string]any{},
			},
		},
	}
	return g.writeJSON(identify)
}

func (g *Gateway) sendResume() error {
	g.mu.Lock()
	seq := 0
	if g.seq != nil {
		seq = *g.seq
	}
	session := g.sessionID
	g.mu.Unlock()

	resume := map[string]any{
		"op": opResume,
		"d": map[string]any{
			"token":      g.token,
			"session_id": session,
			"seq":        seq,
		},
	}
	g.handler.OnStatus("resuming")
	return g.writeJSON(resume)
}

// RequestGuildMembers asks for the lazy member list of a guild channel (op 14),
// the way the official user client populates its member sidebar. Discord
// responds with GUILD_MEMBER_LIST_UPDATE dispatches.
func (g *Gateway) RequestGuildMembers(guildID, channelID string) error {
	g.mu.Lock()
	closed := g.closed
	conn := g.conn
	g.mu.Unlock()
	if closed || conn == nil {
		return nil
	}
	payload := map[string]any{
		"op": opGuildSubscriptions,
		"d": map[string]any{
			"guild_id":   guildID,
			"typing":     true,
			"threads":    false,
			"activities": true,
			"channels": map[string]any{
				// Request a wide window of the member list (covers more members,
				// including some offline, as the official client does on scroll).
				channelID: [][]int{
					{0, 99}, {100, 199}, {200, 299}, {300, 399},
					{400, 499}, {500, 599}, {600, 699},
				},
			},
		},
	}
	return g.writeJSON(payload)
}

func (g *Gateway) heartbeatLoop(conn *websocket.Conn, stop chan struct{}) {
	// Jitter the first beat per the gateway docs.
	first := time.NewTimer(time.Duration(float64(g.heartbeatInterval) * 0.5))
	defer first.Stop()
	select {
	case <-first.C:
		if err := g.sendHeartbeat(conn); err != nil {
			return
		}
	case <-stop:
		return
	case <-g.stopCh:
		return
	}

	ticker := time.NewTicker(g.heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := g.sendHeartbeat(conn); err != nil {
				return
			}
		case <-stop:
			return
		case <-g.stopCh:
			return
		}
	}
}

func (g *Gateway) sendHeartbeat(conn *websocket.Conn) error {
	g.mu.Lock()
	seq := g.seq
	g.mu.Unlock()
	return g.writeJSON(map[string]any{"op": opHeartbeat, "d": seq})
}

func (g *Gateway) writeJSON(v any) error {
	g.mu.Lock()
	conn := g.conn
	g.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("no connection")
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	return conn.WriteJSON(v)
}

func (g *Gateway) handleDispatch(p gatewayPayload) {
	switch p.T {
	case "READY":
		var r Ready
		if err := json.Unmarshal(p.D, &r); err != nil {
			g.handler.OnError(err)
			return
		}
		g.mu.Lock()
		g.sessionID = r.SessionID
		g.resumeURL = r.ResumeGatewayURL
		g.mu.Unlock()
		g.handler.OnStatus("ready")
		g.handler.OnReady(&r)

	case "RESUMED":
		g.handler.OnStatus("ready")

	case "MESSAGE_CREATE":
		var m Message
		if err := json.Unmarshal(p.D, &m); err == nil {
			g.handler.OnMessageCreate(&m)
		}

	case "MESSAGE_UPDATE":
		var m Message
		if err := json.Unmarshal(p.D, &m); err == nil {
			g.handler.OnMessageUpdate(&m)
		}

	case "MESSAGE_DELETE":
		var d struct {
			ID        string `json:"id"`
			ChannelID string `json:"channel_id"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil {
			g.handler.OnMessageDelete(d.ChannelID, d.ID)
		}

	case "GUILD_MEMBER_LIST_UPDATE":
		guildID, members := parseMemberListUpdate(p.D)
		if guildID != "" && len(members) > 0 {
			g.handler.OnMemberListUpdate(guildID, members)
		}

	case "TYPING_START":
		var d struct {
			ChannelID string `json:"channel_id"`
			UserID    string `json:"user_id"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil {
			g.handler.OnTypingStart(d.ChannelID, d.UserID)
		}

	case "PRESENCE_UPDATE":
		var d struct {
			User struct {
				ID string `json:"id"`
			} `json:"user"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil && d.User.ID != "" {
			g.handler.OnPresenceUpdate(d.User.ID, d.Status)
		}

	case "MESSAGE_REACTION_ADD":
		var d struct {
			ChannelID string `json:"channel_id"`
			MessageID string `json:"message_id"`
			UserID    string `json:"user_id"`
			Emoji     Emoji  `json:"emoji"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil {
			g.handler.OnReactionAdd(d.ChannelID, d.MessageID, d.UserID, d.Emoji)
		}

	case "MESSAGE_REACTION_REMOVE":
		var d struct {
			ChannelID string `json:"channel_id"`
			MessageID string `json:"message_id"`
			UserID    string `json:"user_id"`
			Emoji     Emoji  `json:"emoji"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil {
			g.handler.OnReactionRemove(d.ChannelID, d.MessageID, d.UserID, d.Emoji)
		}

	case "APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE":
		// Bot's autocomplete suggestions for a command we're typing. Correlated
		// to our request by nonce.
		var d struct {
			Nonce   string               `json:"nonce"`
			Choices []AutocompleteChoice `json:"choices"`
		}
		if err := json.Unmarshal(p.D, &d); err == nil {
			g.handler.OnAutocompleteResponse(d.Nonce, d.Choices)
		}

	default:
		if debugDispatch {
			fmt.Printf("[GW-DISPATCH] t=%s d=%s\n", p.T, string(p.D))
		}
	}
}

// debugDispatch logs unhandled gateway dispatches when FROSTCORD_GW_DEBUG is set.
var debugDispatch = os.Getenv("FROSTCORD_GW_DEBUG") != ""

// parseMemberListUpdate extracts users from a GUILD_MEMBER_LIST_UPDATE payload.
// The payload has ops[] each with items[] containing {member:{user}} entries
// (and group headers we ignore). SYNC ops carry items; INSERT/UPDATE carry one.
func parseMemberListUpdate(data []byte) (string, []User) {
	var payload struct {
		GuildID string `json:"guild_id"`
		Ops     []struct {
			Op    string `json:"op"`
			Items []struct {
				Member *struct {
					User User `json:"user"`
				} `json:"member"`
			} `json:"items"`
			Item *struct {
				Member *struct {
					User User `json:"user"`
				} `json:"member"`
			} `json:"item"`
		} `json:"ops"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", nil
	}
	seen := make(map[string]bool)
	var members []User
	add := func(u User) {
		if u.ID == "" || seen[u.ID] {
			return
		}
		seen[u.ID] = true
		members = append(members, u)
	}
	for _, op := range payload.Ops {
		for _, it := range op.Items {
			if it.Member != nil {
				add(it.Member.User)
			}
		}
		if op.Item != nil && op.Item.Member != nil {
			add(op.Item.Member.User)
		}
	}
	return payload.GuildID, members
}

// Close shuts down the gateway connection permanently.
func (g *Gateway) Close() {
	g.mu.Lock()
	if g.closed {
		g.mu.Unlock()
		return
	}
	g.closed = true
	conn := g.conn
	g.mu.Unlock()

	close(g.stopCh)
	if conn != nil {
		_ = conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		_ = conn.Close()
	}
}
