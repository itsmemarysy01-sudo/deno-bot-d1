import type { Bot } from "gramio";
import * as d1 from "../storage/d1.ts";
import { buildKeyboard } from "./buttons.ts";

export async function publishContent(
  bot: Bot,
  contentId: string,
  chatIds: number[],
): Promise<{ published: number; failed: number }> {
  const [content, buttons] = await Promise.all([
    d1.getContent(contentId),
    d1.listButtons(contentId),
  ]);
  if (!content) throw new Error(`Content ${contentId} not found`);

  const keyboard = buildKeyboard(buttons);
  let published = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    try {
      const sent = await bot.api.sendMessage({
        chat_id: chatId,
        text: `${content.title}\n\n${content.body}`,
        reply_markup: keyboard,
      });
      await d1.recordPublishedMessage(contentId, chatId, sent.message_id);
      published++;
    } catch (err) {
      console.error(`Failed to publish content ${contentId} to ${chatId}:`, err);
      failed++;
    }
  }

  return { published, failed };
}

export async function propagateContentEdit(
  bot: Bot,
  contentId: string,
): Promise<{ updated: number }> {
  const [content, publishedMessages] = await Promise.all([
    d1.getContent(contentId),
    d1.listPublishedMessages(contentId),
  ]);
  if (!content) throw new Error(`Content ${contentId} not found`);

  let updated = 0;
  for (const msg of publishedMessages) {
    try {
      await bot.api.editMessageText({
        chat_id: msg.chatId,
        message_id: msg.messageId,
        text: `${content.title}\n\n${content.body}`,
      });
      updated++;
    } catch (err) {
      console.error(`Failed to edit message ${msg.messageId} in ${msg.chatId}:`, err);
    }
  }
  return { updated };
}

export async function unpublishContent(bot: Bot, contentId: string): Promise<{ deleted: number }> {
  const publishedMessages = await d1.listPublishedMessages(contentId);
  let deleted = 0;
  for (const msg of publishedMessages) {
    try {
      await bot.api.deleteMessage({ chat_id: msg.chatId, message_id: msg.messageId });
      deleted++;
    } catch (err) {
      console.error(`Failed to delete message ${msg.messageId} in ${msg.chatId}:`, err);
    }
  }
  return { deleted };
}
