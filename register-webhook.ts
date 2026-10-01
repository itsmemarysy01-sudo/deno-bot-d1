// Run locally: deno run --allow-net --allow-env --env-file=.env scripts/register-webhook.ts
//
// Runs on the developer's machine, not as an in-Worker endpoint, so the
// bot token is never sent to a public URL as part of a registration flow.

const publicUrl = Deno.env.get("PUBLIC_URL");
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

if (!publicUrl || !token || !secret) {
  console.error("Requires PUBLIC_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET in .env");
  Deno.exit(1);
}

const webhookUrl = `${publicUrl.replace(/\/$/, "")}/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query", "chat_join_request"],
  }),
});

const data = await res.json();
if (data.ok) {
  console.log(`Webhook registered: ${webhookUrl}`);
} else {
  console.error("Failed to register webhook:", data);
  Deno.exit(1);
}

export {};
