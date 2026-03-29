# 🐾 Multistream Chat Overlay
**Twitch + YouTube · Streamer.bot · GitHub Pages**

---

## 📁 Files

| File | Description |
|---|---|
| `index.html` | Customizer page |
| `style.css` | Customizer styles |
| `script.js` | Customizer logic |
| `overlay.html` | OBS browser source overlay |
| `overlay.css` | Overlay styles |
| `overlay.js` | WebSocket + chat rendering |

---

## 🚀 GitHub Pages Setup

1. Create a GitHub repo (e.g. `chat-overlay`)
2. Upload all 6 files to the root
3. Go to **Settings → Pages → Deploy from branch → main → / (root)**
4. Customizer: `https://YOUR-USERNAME.github.io/chat-overlay/`
5. Overlay: `https://YOUR-USERNAME.github.io/chat-overlay/overlay.html?...params`

---

## 🔧 Streamer.bot Setup

1. Open **Streamer.bot → Servers/Clients → WebSocket Server**
2. Enable the server (default port **7474**)
3. Optionally set a password (enter it in the customizer)
4. Make sure Twitch and/or YouTube accounts are connected

---

## 🎬 OBS Setup

1. Open the customizer → configure → copy the URL
2. Add a **Browser Source** in OBS
3. Paste the URL, set to your canvas size (e.g. 1920×1080)
4. ✅ **Allow transparency**
5. Empty the **Custom CSS** field

---

## ✨ Features

- **Real Twitch & YouTube profile pictures** (falls back to cute generated avatar)
- **Twitch + YouTube** chat in one overlay
- **Platform badges** on each avatar
- **User badges** — mod, sub, VIP, first chat, bits
- **Twitch emote** rendering
- **Pronouns** via `pronouns.alejo.io`
- **Event notifications** — subs, resubs, gift subs, cheers, follows, raids, Super Chats, memberships
- **Twitch Shared Chat** — messages from shared sessions shown with source label
- **Hype Train progress bar** — animated, shows level + progress
- **3 scroll directions** — up, down, horizontal
- **4 entry animations** — slide, bounce, pop, fade
- **Filtering** — ignore accounts, ignore `!` commands
- **WebSocket password** support
- **Auto-reconnects** if Streamer.bot disconnects

---

## ❓ Troubleshooting

**Messages not showing:** Make sure Streamer.bot WebSocket is enabled and the host/port match.

**"Connecting…" stays forever:** Check firewall isn't blocking port 7474. If OBS is on a different PC, use the LAN IP.

**Auth failed:** Double-check the password in the customizer matches Streamer.bot exactly.

**Avatars not loading:** The overlay uses `unavatar.io` for real avatars — OBS must have internet access.

---

## 💜 Credits

Widget style by [MrJordilicious](https://mrjordilicious.com) · [Ko-fi](https://ko-fi.com/mrjordilicious)  
Pronouns by [pronouns.alejo.io](https://pronouns.alejo.io)  
Avatars by [unavatar.io](https://unavatar.io) + [DiceBear](https://dicebear.com) (fallback)
