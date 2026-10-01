// Run locally: deno run --allow-net --allow-env --env-file=.env scripts/unregister-webhook.ts

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) {
  console.error("Requires TELEGRAM_BOT_TOKEN in .env");
  Deno.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
const data = await res.json();
console.log(data.ok ? "Webhook removed." : data);

export {};
