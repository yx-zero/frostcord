package discord

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Remote authentication (QR code login). Mirrors Discord's desktop remote-auth
// flow: we generate an RSA keypair, connect to the remote-auth gateway, show a
// QR the user scans with the Discord mobile app, then receive an encrypted token
// which we decrypt with our private key. No password, no captcha.

const remoteAuthURL = "wss://remote-auth-gateway.discord.gg/?v=2"

// RemoteAuthHandler receives QR-login lifecycle events.
type RemoteAuthHandler interface {
	// OnQRCode fires with the URL to encode as a QR (https://discord.com/ra/<fp>).
	OnQRCode(url string)
	// OnPendingUser fires when the user scans (preview before they approve).
	OnPendingUser(id, username, discriminator, avatar string)
	// OnToken fires with the final token after the user approves.
	OnToken(token string)
	// OnRAError fires on any failure/cancel/timeout.
	OnRAError(err error)
}

type RemoteAuth struct {
	handler RemoteAuthHandler
	key     *rsa.PrivateKey

	mu     sync.Mutex
	conn   *websocket.Conn
	closed bool
	stop   chan struct{}
}

func NewRemoteAuth(handler RemoteAuthHandler) *RemoteAuth {
	return &RemoteAuth{handler: handler, stop: make(chan struct{})}
}

// Start runs the full QR-login flow in the background.
func (r *RemoteAuth) Start() {
	go r.run()
}

func (r *RemoteAuth) run() {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		r.handler.OnRAError(fmt.Errorf("keygen: %w", err))
		return
	}
	r.key = key

	header := http.Header{}
	header.Set("Origin", "https://discord.com")
	header.Set("User-Agent", userAgent)

	conn, _, err := websocket.DefaultDialer.Dial(remoteAuthURL, header)
	if err != nil {
		r.handler.OnRAError(fmt.Errorf("connect: %w", err))
		return
	}
	r.mu.Lock()
	r.conn = conn
	r.mu.Unlock()
	defer conn.Close()

	for {
		select {
		case <-r.stop:
			return
		default:
		}
		var msg map[string]any
		if err := conn.ReadJSON(&msg); err != nil {
			r.mu.Lock()
			closed := r.closed
			r.mu.Unlock()
			if !closed {
				r.handler.OnRAError(fmt.Errorf("read: %w", err))
			}
			return
		}
		if done := r.handle(msg); done {
			return
		}
	}
}

func (r *RemoteAuth) send(v any) error {
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("no connection")
	}
	return conn.WriteJSON(v)
}

func (r *RemoteAuth) handle(msg map[string]any) (done bool) {
	op, _ := msg["op"].(string)
	switch op {
	case "hello":
		// Begin heartbeating, then send our public key.
		if hi, ok := msg["heartbeat_interval"].(float64); ok {
			go r.heartbeatLoop(time.Duration(hi) * time.Millisecond)
		}
		pub, err := x509.MarshalPKIXPublicKey(&r.key.PublicKey)
		if err != nil {
			r.handler.OnRAError(err)
			return true
		}
		_ = r.send(map[string]any{
			"op":                 "init",
			"encoded_public_key": base64.StdEncoding.EncodeToString(pub),
		})

	case "nonce_proof":
		// Decrypt the nonce, SHA-256 it, send back base64url proof.
		enc, _ := msg["encrypted_nonce"].(string)
		nonce, err := r.decrypt(enc)
		if err != nil {
			r.handler.OnRAError(fmt.Errorf("nonce decrypt: %w", err))
			return true
		}
		sum := sha256.Sum256(nonce)
		proof := base64.RawURLEncoding.EncodeToString(sum[:])
		_ = r.send(map[string]any{"op": "nonce_proof", "proof": proof})

	case "pending_remote_init":
		fp, _ := msg["fingerprint"].(string)
		r.handler.OnQRCode("https://discord.com/ra/" + fp)

	case "pending_ticket":
		// User scanned: decrypt the preview payload (id:discrim:avatar:username).
		enc, _ := msg["encrypted_user_payload"].(string)
		payload, err := r.decrypt(enc)
		if err == nil {
			parts := strings.SplitN(string(payload), ":", 4)
			id, discrim, avatar, username := "", "", "", ""
			if len(parts) >= 1 {
				id = parts[0]
			}
			if len(parts) >= 2 {
				discrim = parts[1]
			}
			if len(parts) >= 3 {
				avatar = parts[2]
			}
			if len(parts) >= 4 {
				username = parts[3]
			}
			r.handler.OnPendingUser(id, username, discrim, avatar)
		}

	case "pending_login":
		// User approved: exchange the ticket for the (encrypted) token.
		ticket, _ := msg["ticket"].(string)
		token, err := r.exchangeTicket(ticket)
		if err != nil {
			r.handler.OnRAError(fmt.Errorf("ticket exchange: %w", err))
		} else {
			r.handler.OnToken(token)
		}
		return true

	case "cancel":
		r.handler.OnRAError(fmt.Errorf("login cancelled on phone"))
		return true

	case "heartbeat_ack":
		// nothing to do
	}
	return false
}

func (r *RemoteAuth) heartbeatLoop(interval time.Duration) {
	if interval <= 0 {
		interval = 40 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			if err := r.send(map[string]any{"op": "heartbeat"}); err != nil {
				return
			}
		case <-r.stop:
			return
		}
	}
}

// decrypt does RSA-OAEP(SHA-256) of a base64-standard ciphertext.
func (r *RemoteAuth) decrypt(b64 string) ([]byte, error) {
	ct, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, err
	}
	return rsa.DecryptOAEP(sha256.New(), rand.Reader, r.key, ct, nil)
}

// exchangeTicket POSTs the ticket and decrypts the returned encrypted_token.
func (r *RemoteAuth) exchangeTicket(ticket string) (string, error) {
	body, _ := json.Marshal(map[string]string{"ticket": ticket})
	req, err := http.NewRequest(http.MethodPost,
		apiBase+"/users/@me/remote-auth/login", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Super-Properties", superProperties())
	req.Header.Set("Origin", "https://discord.com")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var out struct {
		EncryptedToken string `json:"encrypted_token"`
		Message        string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.EncryptedToken == "" {
		return "", fmt.Errorf("no token returned: %s", out.Message)
	}
	tokenBytes, err := r.decrypt(out.EncryptedToken)
	if err != nil {
		return "", err
	}
	return string(tokenBytes), nil
}

// Close stops the remote-auth flow.
func (r *RemoteAuth) Close() {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return
	}
	r.closed = true
	conn := r.conn
	r.mu.Unlock()
	close(r.stop)
	if conn != nil {
		_ = conn.Close()
	}
}
