package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
)

// Account is a saved login: a token plus cached identity for the switcher UI.
type Account struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"globalName"`
	AvatarURL  string `json:"avatarUrl"`
	Token      string `json:"token"`
}

// accountStore persists accounts encrypted at rest with AES-GCM. The key is
// derived from a per-install random secret stored alongside, so tokens aren't
// sitting in plaintext. (Not a hardware vault, but far better than plaintext.)
type accountStore struct {
	dir string
}

func newAccountStore() *accountStore {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		base, _ = os.UserHomeDir()
	}
	dir := filepath.Join(base, "frostcord")
	_ = os.MkdirAll(dir, 0o700)
	return &accountStore{dir: dir}
}

func (s *accountStore) accountsPath() string { return filepath.Join(s.dir, "accounts.enc") }
func (s *accountStore) keyPath() string      { return filepath.Join(s.dir, "key") }

// key loads or creates the per-install encryption key.
func (s *accountStore) key() ([]byte, error) {
	raw, err := os.ReadFile(s.keyPath())
	if err == nil && len(raw) >= 32 {
		h := sha256.Sum256(raw)
		return h[:], nil
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	if err := os.WriteFile(s.keyPath(), secret, 0o600); err != nil {
		return nil, err
	}
	h := sha256.Sum256(secret)
	return h[:], nil
}

func (s *accountStore) encrypt(plain []byte) (string, error) {
	key, err := s.key()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nonce, nonce, plain, nil)
	return base64.StdEncoding.EncodeToString(ct), nil
}

func (s *accountStore) decrypt(enc string) ([]byte, error) {
	key, err := s.key()
	if err != nil {
		return nil, err
	}
	data, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, io.ErrUnexpectedEOF
	}
	nonce, ct := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ct, nil)
}

func (s *accountStore) load() ([]Account, error) {
	enc, err := os.ReadFile(s.accountsPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []Account{}, nil
		}
		return nil, err
	}
	plain, err := s.decrypt(string(enc))
	if err != nil {
		// Corrupt or key mismatch — start fresh rather than hard-fail.
		return []Account{}, nil
	}
	var accts []Account
	if err := json.Unmarshal(plain, &accts); err != nil {
		return []Account{}, nil
	}
	return accts, nil
}

func (s *accountStore) save(accts []Account) error {
	plain, err := json.Marshal(accts)
	if err != nil {
		return err
	}
	enc, err := s.encrypt(plain)
	if err != nil {
		return err
	}
	return os.WriteFile(s.accountsPath(), []byte(enc), 0o600)
}

// upsert adds or updates an account by id.
func (s *accountStore) upsert(a Account) error {
	accts, err := s.load()
	if err != nil {
		return err
	}
	found := false
	for i := range accts {
		if accts[i].ID == a.ID {
			accts[i] = a
			found = true
			break
		}
	}
	if !found {
		accts = append(accts, a)
	}
	return s.save(accts)
}

func (s *accountStore) remove(id string) error {
	accts, err := s.load()
	if err != nil {
		return err
	}
	out := accts[:0]
	for _, a := range accts {
		if a.ID != id {
			out = append(out, a)
		}
	}
	return s.save(out)
}
