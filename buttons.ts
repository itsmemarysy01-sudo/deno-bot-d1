import type { Bot } from "gramio";
import { InlineKeyboard } from "gramio";
import * as d1 from "../storage/d1.ts";

export async function addButtonToContent(contentId: string, text: string, url: string) {
  const existing = await d1.listButtons(contentId);
  return d1.addButton(contentId, text, url, existing.length);
}

export function buildKeyboard(buttons: d1.ButtonRow[]): InlineKeyboard | undefined {
  if (buttons.length === 0) return undefined;
  let kb = new InlineKeyboard();
  for (const b of buttons) {
    kb = kb.url(b.text, b.url).row();
  }
  return kb;
}

// Changes a button's URL in D1, then edits every previously published
// message's reply markup so old posts point at the new URL too.
export async function changeButtonUrl(
  bot: Bot,
  buttonId: string,
  newUrl: string,
): Promise<{ updated: number; contentId: string } | null> {
  const button = await d1.getButton(buttonId);
  if (!button) return null;

  await d1.updateButtonUrl(buttonId, newUrl);

  const [buttons, publishedMessages] = await Promise.all([
    d1.listButtons(button.contentId),
    d1.listPublishedMessages(button.contentId),
  ]);
  const keyboard = buildKeyboard(buttons);

  let updated = 0;
  for (const msg of publishedMessages) {
    try {
      await bot.api.editMessageReplyMarkup({
        chat_id: msg.chatId,
        message_id: msg.messageId,
        reply_markup: keyboard,
      });
      updated++;
    } catch (err) {
      console.error(`Failed to update message ${msg.messageId} in ${msg.chatId}:`, err);
    }
  }

  return { updated, contentId: button.contentId };
}

export function formatButtonList(buttons: d1.ButtonRow[]): string {
  if (buttons.length === 0) return "No buttons on this content yet.";
  return buttons.map((b) => `• ${b.id} — "${b.text}" → ${b.url}`).join("\n");
}
