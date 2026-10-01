// Deno Deploy exposes config via Deno.env globally, so (unlike the
// Cloudflare Workers version of this bot) there's no per-request `env`
// object to thread through every function — just read it once here.

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: required("TELEGRAM_WEBHOOK_SECRET"),
  ownerId: required("OWNER_ID"), // kept as string; compared against string(from.id)

  cfAccountId: required("CF_ACCOUNT_ID"),
  cfD1DatabaseId: required("CF_D1_DATABASE_ID"),
  cfApiToken: required("CF_API_TOKEN"),
};
