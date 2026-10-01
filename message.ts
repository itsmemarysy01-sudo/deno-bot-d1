import { config } from "../env.ts";
import { isOwner } from "../telegram.ts";
import { changeButtonUrl } from "../admin/buttons.ts";
import {
  clearConversationState,
  createSupportTicket,
  getConversationState,
} from "../storage/kv.ts";

function senderId(context: any): number | undefined {
  return context.payload?.from?.id;
}

async function continueOwnerConversation(context: any, userId: number): Promise<boolean> {
  const state = await getConversationState(userId);
  if (!state) return false;

  if (state.state === "waiting_for_url") {
    const newUrl = (context.text ?? "").trim();
    const buttonId = state.data?.buttonId as string;
    if (!newUrl || !buttonId) {
      await clearConversationState(userId);
      return true;
    }
    const result = await changeButtonUrl(context.bot, buttonId, newUrl);
    await clearConversationState(userId);
    if (!result) {
      await context.send("That button no longer exists.");
    } else {
      await context.send(
        `Updated the button. ${result.updated} published message(s) now point to the new URL.`,
      );
    }
    return true;
  }

  return false;
}

function newTicketId(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function handleNormalUserMessage(context: any): Promise<void> {
  const text = (context.text ?? "").trim();
  if (!text) return;

  const uid = senderId(context);
  if (!uid) return;

  const ticketId = newTicketId();
  await createSupportTicket(ticketId, uid);

  await context.bot.api.sendMessage({
    chat_id: Number(config.ownerId),
    text: `Anonymous request #${ticketId}\n\n${text}\n\n(Reply with /reply ${ticketId} <message>)`,
  });

  await context.send("Thanks — your message has been passed along. You'll get a reply here.");
}

export async function handleMessage(context: any): Promise<void> {
  const userId = senderId(context);
  if (!userId) return;

  const text = (context.text ?? "").trim();
  if (text.startsWith("/")) return; // handled by bot.command() registrations

  if (isOwner(userId)) {
    await continueOwnerConversation(context, userId);
    return;
  }

  await handleNormalUserMessage(context);
}
