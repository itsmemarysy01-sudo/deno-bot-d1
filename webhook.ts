import type { Bot } from "gramio";
import { config } from "./env.ts";

const TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

export async function handleWebhookRequest(request: Request, bot: Bot): Promise<Response> {
  const incomingSecret = request.headers.get(TELEGRAM_SECRET_HEADER);
  if (incomingSecret !== config.telegramWebhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await bot.handleUpdate(update as never);
  } catch (err) {
    console.error("Error handling update:", err);
    // Still acknowledge with 200 so Telegram doesn't retry indefinitely.
  }

  return new Response("OK", { status: 200 });
}
