import { Bot } from "gramio";
import { config } from "./env.ts";

// On Deno Deploy there's no persistent process either (isolates are
// created per request, reused when warm), so — same as the Cloudflare
// Workers version — a fresh Bot is created and handlers re-registered on
// each webhook request. Cheap: just attaching closures, no network I/O.
export function createBot(): Bot {
  return new Bot(config.telegramBotToken);
}

export function isOwner(userId: number | undefined): boolean {
  return userId !== undefined && String(userId) === config.ownerId;
}
