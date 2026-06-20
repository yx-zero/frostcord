package main

import (
	"fmt"
	"os"
	"time"

	"frostcord/internal/discord"
)

// Standalone harness to validate REST + Gateway against a real token, without
// launching the GUI. Run with: go run ./cmd/probe <token>
// Build-tagged out of the main app via its own package main in a subdir.

type probeHandler struct {
	done chan struct{}
	got  int
}

func (h *probeHandler) OnReady(r *discord.Ready) {
	fmt.Printf("[READY] user=%s#%s id=%s guilds=%d dms=%d session=%s\n",
		r.User.Username, r.User.Discriminator, r.User.ID,
		len(r.Guilds), len(r.PrivateChannels), r.SessionID)
	if r.UserSettings == nil {
		fmt.Println("[READY] user_settings is NIL (no legacy order)")
	} else {
		fmt.Printf("[READY] user_settings: %d guild_positions, %d folders\n",
			len(r.UserSettings.GuildPositions), len(r.UserSettings.GuildFolders))
		ord := r.UserSettings.OrderedGuildIDs()
		fmt.Printf("[READY] ordered guild ids (%d): %v\n", len(ord), firstN(ord, 8))
	}
	close(h.done)
}

func firstN(s []string, n int) []string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
func (h *probeHandler) OnMessageCreate(m *discord.Message) {
	h.got++
	fmt.Printf("[MSG] #%s <%s> %s\n", m.ChannelID, m.Author.Username, m.Content)
}
func (h *probeHandler) OnMessageUpdate(m *discord.Message)          {}
func (h *probeHandler) OnMessageDelete(channelID, messageID string) {}
func (h *probeHandler) OnMemberListUpdate(guildID string, members []discord.User) {
	fmt.Printf("[MEMBERS] guild=%s got %d members\n", guildID, len(members))
}
func (h *probeHandler) OnTypingStart(channelID, userID string)                                    {}
func (h *probeHandler) OnPresenceUpdate(userID, status string)                                    {}
func (h *probeHandler) OnReactionAdd(c, m, u string, e discord.Emoji)                             {}
func (h *probeHandler) OnReactionRemove(c, m, u string, e discord.Emoji)                          {}
func (h *probeHandler) OnAutocompleteResponse(nonce string, choices []discord.AutocompleteChoice) {}
func (h *probeHandler) OnError(err error)                                                         { fmt.Println("[ERR]", err) }
func (h *probeHandler) OnStatus(status string)                                                    { fmt.Println("[STATUS]", status) }

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: probe <token>")
		os.Exit(1)
	}
	token := os.Args[1]

	// 1) REST: validate token
	rest := discord.NewREST(token)
	self, err := rest.CurrentUser()
	if err != nil {
		fmt.Println("CurrentUser failed:", err)
		os.Exit(1)
	}
	fmt.Printf("[REST] logged in as %s (%s) id=%s\n",
		self.DisplayName(), self.Username, self.ID)

	// 2) REST: guilds
	guilds, err := rest.Guilds()
	if err != nil {
		fmt.Println("Guilds failed:", err)
	} else {
		fmt.Printf("[REST] %d guilds\n", len(guilds))
		for i, g := range guilds {
			if i >= 5 {
				fmt.Printf("       ... and %d more\n", len(guilds)-5)
				break
			}
			fmt.Printf("       - %s (%s)\n", g.Name, g.ID)
		}
	}

	// 3) REST: DM channels + try fetching messages from the first available channel
	dms, err := rest.DMChannels()
	if err != nil {
		fmt.Println("DMChannels failed:", err)
	} else {
		fmt.Printf("[REST] %d DM channels\n", len(dms))
	}

	// pick a channel to read: first DM, else first guild's first text channel
	var testChannel string
	if len(dms) > 0 {
		testChannel = dms[0].ID
	} else if len(guilds) > 0 {
		chans, cerr := rest.GuildChannels(guilds[0].ID)
		if cerr == nil {
			for _, c := range chans {
				if c.Type == discord.ChannelGuildText {
					testChannel = c.ID
					break
				}
			}
		}
	}
	if testChannel != "" {
		msgs, merr := rest.Messages(testChannel, 5)
		if merr != nil {
			fmt.Println("Messages failed:", merr)
		} else {
			fmt.Printf("[REST] fetched %d messages from channel %s\n", len(msgs), testChannel)
			for _, m := range msgs {
				fmt.Printf("       <%s> %s\n", m.Author.Username, truncate(m.Content, 60))
			}
		}
	}

	// 3b) Favorite GIFs (account-synced via settings proto) + trending
	favs, ferr := rest.FavoriteGifs()
	if ferr != nil {
		fmt.Println("FavoriteGifs failed:", ferr)
	} else {
		fmt.Printf("[REST] %d favorite GIFs\n", len(favs))
		for i, f := range favs {
			if i >= 3 {
				break
			}
			fmt.Printf("       - %dx%d %s\n", f.Width, f.Height, truncate(f.Src, 70))
		}
	}
	trend, terr := rest.SearchGifs("", 5)
	if terr != nil {
		fmt.Println("Trending GIFs failed:", terr)
	} else {
		fmt.Printf("[REST] %d trending GIFs\n", len(trend))
	}

	// 3c) Guild sidebar order from PreloadedUserSettings proto.
	order, oerr := rest.GuildOrder()
	if oerr != nil {
		fmt.Println("GuildOrder failed:", oerr)
	} else {
		fmt.Printf("[REST] guild order has %d ids; first 8: %v\n", len(order), firstN(order, 8))
	}

	// 3d) Full member search (includes offline) for the first guild.
	if len(guilds) > 0 {
		mem, merr := rest.SearchGuildMembers(guilds[0].ID, "", 100)
		if merr != nil {
			fmt.Println("SearchGuildMembers failed:", merr)
		} else {
			fmt.Printf("[REST] members-search returned %d members for %s\n", len(mem), guilds[0].Name)
		}
	}

	// 3e) Own profile (banner/bio/pronouns/badges).
	prof, perr := rest.UserProfile(self.ID)
	if perr != nil {
		fmt.Println("UserProfile failed:", perr)
	} else {
		fmt.Printf("[REST] profile: name=%s bio=%q pronouns=%q banner=%v badges=%d\n",
			prof.User.Username, truncate(prof.User.Bio, 40), prof.User.Pronouns,
			prof.BannerURL() != "", len(prof.Badges))
	}

	// 4) Gateway: connect and wait for READY
	h := &probeHandler{done: make(chan struct{})}
	gw := discord.NewGateway(token, h)
	go gw.Connect()

	select {
	case <-h.done:
		fmt.Println("[OK] Gateway READY received.")
	case <-time.After(20 * time.Second):
		fmt.Println("[TIMEOUT] No READY within 20s")
		gw.Close()
		os.Exit(1)
	}

	// Request member list for the first guild's first text channel (op 14).
	if len(guilds) > 0 {
		chans, _ := rest.GuildChannels(guilds[0].ID)
		for _, c := range chans {
			if c.Type == discord.ChannelGuildText {
				fmt.Printf("[INFO] requesting members for guild %s channel %s\n", guilds[0].ID, c.ID)
				_ = gw.RequestGuildMembers(guilds[0].ID, c.ID)
				break
			}
		}
	}

	// Listen for a few seconds of live events.
	fmt.Println("[INFO] listening for live events for 8s...")
	time.Sleep(8 * time.Second)
	gw.Close()
	fmt.Printf("[DONE] received %d live messages during window\n", h.got)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
