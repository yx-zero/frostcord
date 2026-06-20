# Frostcord

A third-party Discord client with a Telegram-style UI, an Apple-inspired
**liquid-glass** aesthetic, smooth animations, and deep theming. Built with
**Go + Wails** (native backend) and **React + TypeScript** (frontend).

> ⚠️ **Disclaimer:** Frostcord is an unofficial client and using it violates
> Discord's Terms of Service. It may put your account at risk. Use at your own
> risk. This project is for educational purposes.

## Features

- **Telegram-style chat** — real message bubbles, send-state indicators
  (sending → sent → delivered), grouped messages, smooth animations
- **Liquid-glass UI** — frosted surfaces with SVG refraction, over a themeable
  gradient wallpaper
- **Theming** — Catppuccin Mocha (default), Latte, Discord Dark, Telegram,
  AMOLED, plus custom colors and adjustable glass intensity
- **Login** — QR code (remote-auth, no password/captcha) and token login, with
  encrypted local multi-account storage + account switching
- **Messaging** — markdown (bold/italic/code/spoilers/headings/code blocks),
  mentions with `@` autocomplete, `:shortcode:` emoji rendered Discord-style
  (Twemoji), custom emoji, replies (with jump-to), edit, delete, reactions
- **Media** — image/file upload + paste, GIF picker (favorites/trending/search),
  stickers, image lightbox, embeds, polls
- **Realtime** — gateway connection with typing indicators (read-only),
  presence (online/idle/dnd/offline), live message/reaction updates
- **Navigation** — server list (in your real order), channels (correctly
  sorted), DMs, member lists, pinned messages, friends list, user profiles
- **Context menus** for servers, channels, DMs, and messages
- **Frameless window** with custom controls

## Tech stack

| Layer | Tech |
|-------|------|
| Shell | Wails v2 (WebView2) |
| Backend | Go — REST (`api/v9`), Gateway WebSocket, remote-auth |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (CSS-variable theming) |
| Animation | Framer Motion |
| State | Zustand |

## Development

Requires Go, Node.js, and the [Wails CLI](https://wails.io).

```bash
wails dev     # live development with hot reload
wails build   # build a production binary
```

The Go backend lives in `main.go`, `app.go`, `accounts.go`, and
`internal/discord/`. The frontend is in `frontend/`.
