import { InlineKeyboard } from "gramio";
import { config } from "../env.ts";
import { joinApproveData, joinDeclineData } from "./callback.ts";

export async function handleJoinRequest(context: any): Promise<void> {
  const request = context.payload; // raw ChatJoinRequest
  const chatId = request?.chat?.id;
  const userId = request?.from?.id;
  if (!chatId || !userId) return;

  const label = request.from?.username
    ? `@${request.from.username}`
    : request.from?.first_name ?? `user ${userId}`;

  const keyboard = new InlineKeyboard()
    .text("Approve", joinApproveData.pack({ chatId, userId }))
    .row()
    .text("Decline", joinDeclineData.pack({ chatId, userId }));

  await context.bot.api.sendMessage({
    chat_id: Number(config.ownerId),
    text: `Join request from ${label} for chat ${chatId}.`,
    reply_markup: keyboard,
  });
}
