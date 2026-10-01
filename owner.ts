// Owner-only admin commands. Every handler re-checks OWNER_ID itself
// rather than trusting router-level wiring alone.

import { isOwner } from "../telegram.ts";
import * as d1 from "../storage/d1.ts";
import {
  createContentFromCommand,
  editContentBody,
  formatContentList,
  formatContentSummary,
} from "../admin/content.ts";
import { addButtonToContent, changeButtonUrl, formatButtonList } from "../admin/buttons.ts";
import { propagateContentEdit, publishContent, unpublishContent } from "../admin/publish.ts";
import { clearConversationState, getSupportTicket, setConversationState } from "../storage/kv.ts";

function senderId(context: any): number | undefined {
  return context.payload?.from?.id;
}

async function requireOwner(context: any): Promise<boolean> {
  if (isOwner(senderId(context))) return true;
  await context.send("This action is restricted to the bot owner.");
  return false;
}

// /new <title> | <body>
export async function handleNew(context: any) {
  if (!(await requireOwner(context))) return;
  const args = (context.text ?? "").split("|");
  const title = args[0]?.trim();
  const body = args.slice(1).join("|").trim();
  if (!title || !body) {
    await context.send("Usage: /new <title> | <body>");
    return;
  }
  const content = await createContentFromCommand(title, body);
  await context.send(`Created content ${content.id}\n\n${formatContentSummary(content)}`);
}

// /list
export async function handleList(context: any) {
  if (!(await requireOwner(context))) return;
  const items = await d1.listContent();
  await context.send(formatContentList(items));
}

// /publish <contentId> <chatId1,chatId2,...>
export async function handlePublish(context: any) {
  if (!(await requireOwner(context))) return;
  const [contentId, chatIdsRaw] = (context.text ?? "").trim().split(/\s+/);
  if (!contentId || !chatIdsRaw) {
    await context.send("Usage: /publish <contentId> <chatId1,chatId2,...>");
    return;
  }
  const chatIds = chatIdsRaw.split(",").map((s: string) => Number(s.trim())).filter(Boolean);
  const result = await publishContent(context.bot, contentId, chatIds);
  await context.send(`Published to ${result.published} chat(s). ${result.failed} failed.`);
}

// /edit <contentId> | <new body>
export async function handleEdit(context: any) {
  if (!(await requireOwner(context))) return;
  const raw = context.text ?? "";
  const sep = raw.indexOf("|");
  if (sep === -1) {
    await context.send("Usage: /edit <contentId> | <new body>");
    return;
  }
  const contentId = raw.slice(0, sep).trim();
  const newBody = raw.slice(sep + 1).trim();
  await editContentBody(contentId, newBody);
  const result = await propagateContentEdit(context.bot, contentId);
  await context.send(`Updated ${result.updated} published message(s).`);
}

// /unpublish <contentId>
export async function handleUnpublish(context: any) {
  if (!(await requireOwner(context))) return;
  const contentId = (context.text ?? "").trim();
  if (!contentId) {
    await context.send("Usage: /unpublish <contentId>");
    return;
  }
  const result = await unpublishContent(context.bot, contentId);
  await context.send(`Deleted ${result.deleted} published message(s).`);
}

// /addbutton <contentId> <text> | <url>
export async function handleAddButton(context: any) {
  if (!(await requireOwner(context))) return;
  const raw = (context.text ?? "").trim();
  const firstSpace = raw.indexOf(" ");
  const sep = raw.indexOf("|");
  if (firstSpace === -1 || sep === -1) {
    await context.send("Usage: /addbutton <contentId> <text> | <url>");
    return;
  }
  const contentId = raw.slice(0, firstSpace).trim();
  const text = raw.slice(firstSpace + 1, sep).trim();
  const url = raw.slice(sep + 1).trim();
  const button = await addButtonToContent(contentId, text, url);
  await context.send(`Added button ${button.id} ("${text}" → ${url}).`);
}

// /buttons <contentId>
export async function handleButtons(context: any) {
  if (!(await requireOwner(context))) return;
  const contentId = (context.text ?? "").trim();
  if (!contentId) {
    await context.send("Usage: /buttons <contentId>");
    return;
  }
  const buttons = await d1.listButtons(contentId);
  await context.send(formatButtonList(buttons));
}

// /setbuttonurl <buttonId> -> starts a short conversation asking for the new URL
export async function handleSetButtonUrl(context: any) {
  if (!(await requireOwner(context))) return;
  const buttonId = (context.text ?? "").trim();
  if (!buttonId) {
    await context.send("Usage: /setbuttonurl <buttonId>");
    return;
  }
  const button = await d1.getButton(buttonId);
  if (!button) {
    await context.send(`Button ${buttonId} not found.`);
    return;
  }
  await setConversationState(senderId(context)!, {
    state: "waiting_for_url",
    data: { buttonId },
  });
  await context.send(`Send the new URL for "${button.text}" (or /cancel).`);
}

// /schedule <contentId> <chatId1,chatId2,...> <ISO-datetime>
export async function handleSchedule(context: any) {
  if (!(await requireOwner(context))) return;
  const [contentId, chatIdsRaw, whenRaw] = (context.text ?? "").trim().split(/\s+/);
  if (!contentId || !chatIdsRaw || !whenRaw) {
    await context.send("Usage: /schedule <contentId> <chatId1,chatId2,...> <2026-09-20T10:00>");
    return;
  }
  const runAt = new Date(whenRaw).getTime();
  if (Number.isNaN(runAt)) {
    await context.send("Couldn't parse that date/time.");
    return;
  }
  const chatIds = chatIdsRaw.split(",").map((s: string) => Number(s.trim())).filter(Boolean);
  const task = await d1.scheduleTask(contentId, chatIds, runAt);
  await context.send(`Scheduled ${task.id} for ${new Date(runAt).toLocaleString()}.`);
}

// /reply <ticketId> <message> -- reply to an anonymous support request
export async function handleReply(context: any) {
  if (!(await requireOwner(context))) return;
  const raw = (context.text ?? "").trim();
  const spaceIdx = raw.indexOf(" ");
  if (spaceIdx === -1) {
    await context.send("Usage: /reply <ticketId> <message>");
    return;
  }
  const ticketId = raw.slice(0, spaceIdx).trim();
  const message = raw.slice(spaceIdx + 1).trim();

  const ticket = await getSupportTicket(ticketId);
  if (!ticket) {
    await context.send(`Ticket #${ticketId} not found or expired.`);
    return;
  }
  try {
    await context.bot.api.sendMessage({ chat_id: ticket.userId, text: message });
    await context.send(`Sent to ticket #${ticketId}.`);
  } catch (err) {
    await context.send(`Failed to send: ${(err as Error).message}`);
  }
}

// /cancel — clears any in-progress conversation state.
export async function handleCancel(context: any) {
  const uid = senderId(context);
  if (uid) await clearConversationState(uid);
  await context.send("Cancelled.");
}
