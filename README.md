# Caption Bot

Post an image, collect anonymous captions, let the server vote, announce a winner. Built with discord.js v14, deployable free on Render.

## Commands

| Command | Who | What it does |
|---|---|---|
| `/caption-new` | Manage Messages perm | Attach an image to start a new contest |
| `/caption-end` | Manage Messages perm | Close submissions early, start voting |
| `/caption-results` | Manage Messages perm | Close voting early, announce the winner |
| `/caption-cancel` | Manage Messages perm | Cancel the current contest |
| `/caption-status` | Anyone | Check the current phase / entry count |

**Flow:** `/caption-new` (with image) → members click **Submit Caption** → a popup form lets them type their caption → after the submission timer (default 10 min) the bot posts all entries anonymously with number-emoji reactions to vote → after the voting timer (default 5 min) it tallies reactions and announces the winner (ties are announced too).

One contest per server at a time. Max 10 entries per contest (keeps voting to single-digit emoji reactions). One caption per person — resubmitting overwrites their previous entry.

## 1. Create the Discord bot

1. Go to https://discord.com/developers/applications → **New Application**.
2. Under **Bot**, click **Reset Token** to get your bot token (this is `DISCORD_TOKEN`). Keep it secret.
3. Still under **Bot**, make sure **Public Bot** is on if you want others to invite it (optional).
4. Under **OAuth2 → URL Generator**, check scopes `bot` and `applications.commands`. Under bot permissions, check at least: `Send Messages`, `Embed Links`, `Attach Files`, `Add Reactions`, `Read Message History`, `Use Slash Commands`.
5. Copy the generated URL, open it in a browser, and invite the bot to your server.
6. Copy your **Application ID** from **General Information** — this is `CLIENT_ID`.
7. (Optional, for instant command testing) Enable Developer Mode in Discord (User Settings → Advanced), right-click your server icon → **Copy Server ID** — this is `GUILD_ID`.

## 2. Push this project to GitHub

```bash
git init
git add .
git commit -m "Initial caption bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/` and `.env` so you never commit secrets.

## 3. Deploy on Render

1. Go to https://render.com → **New +** → **Web Service**.
2. Connect your GitHub repo.
3. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free is fine to start
4. Under **Environment**, add these variables (from your `.env.example`):
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID` (optional, remove once live in production)
   - `CAPTION_SUBMIT_MINUTES` (optional, defaults to 10)
   - `CAPTION_VOTE_MINUTES` (optional, defaults to 5)
5. Click **Create Web Service**. Render will build and start it; watch the logs for `Logged in as YourBot#1234`.

### Important Render caveat
Render's **free** web service tier spins down after ~15 minutes of no HTTP traffic, and spinning back up takes a few seconds — during that window the bot is offline and won't respond to Discord. The bot includes a tiny Express server (`GET /`) specifically so Render sees an active port, but that alone won't stop the free tier from sleeping since Discord traffic isn't HTTP traffic Render tracks the same way.

Two ways to fix this:
- **Upgrade to a paid Render instance** (simplest, recommended if this is a real community tool) — no spin-down.
- **Free workaround:** use a free uptime pinger (e.g. UptimeRobot, cron-job.org) to hit your Render URL every 5–10 minutes, which keeps the service warm. Not 100% reliable but works for most casual use.

## 4. Test it

In your server, run `/caption-new` and attach an image. Click **Submit Caption**, fill out the popup, then either wait out the timer or run `/caption-end` as an admin to jump straight to voting.

## Notes & limitations

- State is stored in memory, not a database — if the bot restarts mid-contest, that contest is lost. Fine for casual use; let me know if you want SQLite/Postgres persistence added.
- Max 10 entries per contest by design (keeps voting to simple number-emoji reactions instead of needing pagination).
- Only one contest can run per server at a time.
