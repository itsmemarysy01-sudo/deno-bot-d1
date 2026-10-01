import { createBot } from "./src/telegram.ts";
import { registerRoutes } from "./src/router.ts";
import { handleWebhookRequest } from "./src/webhook.ts";
import * as d1 from "./src/storage/d1.ts";
import { publishContent } from "./src/admin/publish.ts";

const WEBHOOK_PATH = "/telegram/webhook";

// Checks scheduled_tasks every minute and publishes anything due — no new
// incoming Telegram update required. Deno Deploy runs this independently
// of request traffic.
Deno.cron("publish due scheduled posts", "* * * * *", async () => {
  try {
    const bot = createBot();
    const due = await d1.listDueTasks(Date.now());
    for (const task of due) {
      try {
        await publishContent(bot, task.contentId, task.chatIds);
        await d1.markTaskStatus(task.id, "done");
      } catch (err) {
        console.error(`Scheduled task ${task.id} failed:`, err);
        await d1.markTaskStatus(task.id, "failed");
      }
    }
  } catch (err) {
    console.error("Scheduled publish check failed:", err);
  }
});

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (url.pathname === WEBHOOK_PATH && request.method === "POST") {
    const bot = createBot();
    registerRoutes(bot);
    return handleWebhookRequest(request, bot);
  }

  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response("Telegram personal bot is running.", { status: 200 });
  }

  return new Response("Not found", { status: 404 });
});
