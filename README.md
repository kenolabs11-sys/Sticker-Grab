# StickerGrab

**Grab stickers and GIFs from your TikTok DMs, collect them into packs, and send them to Telegram or Discord — all local, all on your machine.**

Made by [KenoLabs](https://kenolabs.dev).

---

## What it is

StickerGrab is a small Chrome (and Chromium-based) browser extension paired with a lightweight desktop app. The extension grabs the stickers and GIFs people send you in TikTok DMs; the desktop app lets you browse your collection, group stickers into packs, convert WebP to GIF, and send a pack straight to Telegram (as a real, shareable sticker set) or Discord (posted to a channel).
> **Note:** This repository contains the source code for the browser extension only. 
> The desktop companion app (packs, GIF conversion, Telegram/Discord sending) is closed-source 
> and distributed as a downloadable installer — see [Getting started](#getting-started).

Nothing leaves your machine except the sticker files themselves, sent directly to Telegram/Discord through your own bot. There is no StickerGrab server, no account, and no telemetry.

## Features

- **Grab stickers from TikTok DMs** via a small browser extension.
- **Collection dashboard** — browse everything you've grabbed, with type (animated/sticker/frame/image) and source (TikTok vs. your own uploads) shown at a glance.
- **Packs** — group stickers into named packs, add or remove stickers, rename, delete.
- **WebP → GIF conversion** — with scale, playback speed, and background-matte options (including a Discord-dark matte for transparent stickers).
- **Send to Telegram** — turns a pack into a real, shareable Telegram sticker set (`t.me/addstickers/...`), using **your own** Telegram bot. Static and animated (video) stickers are both supported.
- **Send to Discord** — posts a pack's stickers/GIFs to a channel in your own server, using **your own** Discord bot.
- **ZIP export** for anything you'd rather just save locally.
- Cross-platform desktop app (Windows + macOS) built with Tauri.

## Why "your own bot"?

StickerGrab has no backend server — everything runs on your machine and talks directly to Telegram/Discord's APIs. If StickerGrab shipped with a single shared bot, its token would have to live inside every user's copy of the app, which anyone could extract and abuse — getting the bot banned for everyone. Instead, each user creates their own free bot (a two-minute process via `@BotFather` for Telegram, or the Discord Developer Portal for Discord) and connects it in Settings. Your bot, your data, your rate limits.

## Getting started

1. **Download** the latest installer for your platform from [Releases](../../releases) (Windows `.exe`/`.msi`, macOS `.dmg`).
2. Open the app — it'll walk you through installing the browser extension (supported: Chrome, Brave, Edge, Opera, Vivaldi).
3. Open TikTok DMs, click **Export Stickers** on a chat with stickers you want.
4. Back in the app, browse your **Collection**, build a **Pack**, convert to GIF if you like.
5. (Optional) Connect Telegram and/or Discord in **Settings**, then send a pack straight from its detail view.


## Privacy

See [`PRIVACY.md`](./PRIVACY.md) for the full policy. Short version: nothing is collected or sent anywhere except the sticker files you choose to send, going directly to Telegram/Discord through your own bot credentials, stored locally.

## Contributing

Issues and pull requests are welcome — see [Issues](../../issues). This is a solo/indie project maintained by KenoLabs, so response times may vary, but all feedback is read.

## License
MIT — see [`LICENSE`](./LICENSE).

## Support

If StickerGrab saved you time, consider [supporting KenoLabs on Ko-fi](https://ko-fi.com/kenolabs) — or just star the repo, that helps too. 🩷
