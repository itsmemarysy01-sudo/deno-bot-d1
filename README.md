# Personal Telegram Bot — Deno Deploy + D1 (via REST) + GramIO

A privacy-oriented personal Telegram bot that runs entirely on **Deno
Deploy**, deployed straight from the CLI — **no GitHub repo or Actions
required**. Cloudflare D1 is still used as the durable database, but since
Deno Deploy has no native D1 binding (that only exists inside Cloudflare
Workers), this talks to D1 over its **REST API** instead. Session state
uses Deno Deploy's own built-in, globally-replicated KV — zero setup.

## Why this shape

- **Deno Deploy** — the actual compute. `deployctl deploy` ships code
  straight from your machine; no git push, no CI pipeline, no GitHub App.
- **D1 over HTTP** — same SQL database, same schema, reached via
  `https://api.cloudflare.com/.../d1/database/{id}/query` instead of a
  Workers binding. Every call is a stateless `fetch()`.
- **Deno KV** — native to Deno Deploy, durable, no provisioning step.
  Used only for short-lived conversation state (TTL'd) and support tickets.
- **GramIO** — officially multi-runtime (Node/Bun/**Deno**), so the bot
  logic needs no framework swap from earlier iterations of this project.
- **`Deno.cron`** — scheduled publishing, checked every minute, native to
  the runtime.

One unavoidable exception: **creating the D1 database itself** still
requires Cloudflare's own tooling (dashboard or `wrangler`) once, since D1
is a Cloudflare-provisioned resource — nothing runs that step from GitHub
either, it's just a one-time setup click/command, not an ongoing dependency.

## Project layout

```
telegram-bot-deno-d1/
├── main.ts                   # Deno.serve (webhook) + Deno.cron (scheduled publish)
├── deno.json                  # tasks + import map (gramio via npm:)
├── .env.example
├── migrations/001_init.sql
├── scripts/
│   ├── migrate-d1.ts           # applies the schema via D1's REST API (no wrangler needed)
│   ├── register-webhook.ts     # run locally — token never touches a public endpoint
│   └── unregister-webhook.ts
└── src/
    ├── env.ts                   # config singleton (Deno.env read once)
    ├── telegram.ts               # Bot factory, isOwner()
    ├── router.ts                 # command + update-type registration
    ├── webhook.ts                 # secret-token validation
    ├── handlers/
    │   ├── message.ts              # conversation continuation + anonymous support
    │   ├── callback.ts             # join-request approve/decline buttons
    │   ├── owner.ts                 # every owner-only admin command
    │   └── join-request.ts
    ├── admin/
    │   ├── content.ts
    │   ├── publish.ts
    │   └── buttons.ts
    └── storage/
        ├── d1-client.ts           # D1 REST API client (the key piece)
        ├── d1.ts                   # durable data: content, buttons, published messages, schedules
        └── kv.ts                   # Deno KV: conversation state + support tickets
```

## Setup

### 1. Telegram
- Create the bot with [@BotFather](https://t.me/BotFather); copy the token.
- Get your Telegram user id from [@userinfobot](https://t.me/userinfobot) — this is `OWNER_ID`.

### 2. D1 database (one-time, via Cloudflare — no GitHub involved)
Either the [Cloudflare dashboard](https://dash.cloudflare.com) (Workers & Pages → D1 → Create database) or, if you have Node/npm available for this one step:
```
npx wrangler d1 create personal-bot-db
```
Either way you need three values for `.env`:
- `CF_ACCOUNT_ID` — found in the dashboard sidebar
- `CF_D1_DATABASE_ID` — shown after creating the database
- `CF_API_TOKEN` — create one at My Profile → API Tokens, with **D1 Edit** permission for your account

### 3. Deno
Install the [Deno CLI](https://deno.com) and `deployctl`:
```
deno install -A -g jsr:@deno/deployctl
```

### 4. Configure
```
cp .env.example .env
```
Fill in all values from steps 1–2, plus a random `TELEGRAM_WEBHOOK_SECRET`.

### 5. Apply the schema
```
deno task migrate
```
(Runs `scripts/migrate-d1.ts` against the D1 REST API directly — no wrangler needed for this step.)

## Local development

```
deno task dev
```

To actually receive Telegram updates locally, use a tunnel (`cloudflared
tunnel` or `ngrok`) pointed at the dev server, set `PUBLIC_URL` in `.env`
to the tunnel URL, then run `deno task register`.

## Deploying — no GitHub required

```
deployctl deploy --project=YOUR_PROJECT_NAME --entrypoint=main.ts
```

(Edit the `deploy` task in `deno.json` with your actual project name first,
or pass `--project` directly.) This uploads your local files straight to
Deno Deploy — no repository, no Actions workflow, no webhook from GitHub.

Set the real secrets on the deployed project (via the Deno Deploy
dashboard's Environment Variables, or `deployctl` flags — check `deployctl
deploy --help` for the current syntax, since this can change):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `OWNER_ID`,
`CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_API_TOKEN`.

Deploy gives you a URL like `https://your-project.deno.dev`. Set
`PUBLIC_URL` to that in your local `.env` and run:
```
deno task register
```

## Owner commands

| Command | Purpose |
|---|---|
| `/new <title> \| <body>` | Create a piece of content |
| `/list` | List recent content with ids |
| `/publish <contentId> <chatId1,chatId2,...>` | Publish to one or more chats |
| `/edit <contentId> \| <new body>` | Edit content and update every published copy |
| `/unpublish <contentId>` | Delete every published copy |
| `/addbutton <contentId> <text> \| <url>` | Add a button to content |
| `/buttons <contentId>` | List a content item's buttons with ids |
| `/setbuttonurl <buttonId>` | Change a button's URL everywhere it's posted |
| `/schedule <contentId> <chatIds> <2026-09-20T10:00>` | Schedule a future publish |
| `/reply <ticketId> <message>` | Reply to an anonymous support request |
| `/cancel` | Cancel an in-progress flow |

Every handler re-checks the sender's Telegram id against `OWNER_ID` itself
— no admins table, no username-based auth.

## Normal users

Plain text from a non-owner is relayed to the owner as an anonymous,
numbered request (`Anonymous request #ab12cd`), without exposing the
sender's Telegram id or username. The owner replies with `/reply
<ticketId> <message>`. The ticket→user mapping lives in Deno KV with a
24-hour TTL.

## Privacy

- D1 holds only `bot_config`, `content`, `buttons`, `published_messages`,
  `scheduled_tasks` — no user/message-history/analytics tables.
- Deno KV holds only TTL'd conversation state and support tickets.
- The bot token and D1 credentials are Deno Deploy secrets, never
  committed or stored in the database.

## A note on how this was built

The GramIO API usage (`Bot`, `.command()`, `.on()`, `.callbackQuery()`,
`context.send()`, `InlineKeyboard`, `CallbackData`, `bot.api.<method>`,
`bot.handleUpdate()`) matches GramIO's documented surface, and I verified
GramIO explicitly supports Deno natively before building this (it's one of
their three supported runtimes). The D1 REST API shape
(`POST .../d1/database/{id}/query` with `{sql, params}`, response
`{success, result: [{results, success}]}`) is Cloudflare's documented,
stable API. A couple of GramIO `context` property names I'm confident
about but couldn't execute-verify here read sender/chat data via
`context.payload` instead (the raw Telegram object) to avoid depending on
exact shortcut naming. Worth running `deno task dev` early to confirm
everything wires up before relying on it in production.
