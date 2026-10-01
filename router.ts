import type { Bot } from "gramio";
import { handleMessage } from "./handlers/message.ts";
import {
  handleJoinApprove,
  handleJoinDecline,
  joinApproveData,
  joinDeclineData,
} from "./handlers/callback.ts";
import { handleJoinRequest } from "./handlers/join-request.ts";
import {
  handleAddButton,
  handleButtons,
  handleCancel,
  handleEdit,
  handleList,
  handleNew,
  handlePublish,
  handleReply,
  handleSchedule,
  handleSetButtonUrl,
  handleUnpublish,
} from "./handlers/owner.ts";

export function registerRoutes(bot: Bot): void {
  bot
    .command("start", (context) =>
      context.send(
        "Hi! This bot is privately operated. Send a message and it'll be passed along, or /support if you need help.",
      ),
    )
    .command("new", (context) => handleNew(context))
    .command("list", (context) => handleList(context))
    .command("publish", (context) => handlePublish(context))
    .command("edit", (context) => handleEdit(context))
    .command("unpublish", (context) => handleUnpublish(context))
    .command("addbutton", (context) => handleAddButton(context))
    .command("buttons", (context) => handleButtons(context))
    .command("setbuttonurl", (context) => handleSetButtonUrl(context))
    .command("schedule", (context) => handleSchedule(context))
    .command("reply", (context) => handleReply(context))
    .command("support", (context) =>
      context.send("Go ahead — send your message as a normal text message and it'll be passed along."),
    )
    .command("cancel", (context) => handleCancel(context));

  bot.on("message", (context) => handleMessage(context));
  bot.on("chat_join_request", (context) => handleJoinRequest(context));

  bot.callbackQuery(joinApproveData, (context) => handleJoinApprove(context));
  bot.callbackQuery(joinDeclineData, (context) => handleJoinDecline(context));
}
