// Deno Deploy ships a built-in, globally-replicated KV store — no setup,
// no separate service to provision (unlike the D1 side of this project).
// Used here only for short-lived conversation state, always with a TTL.

const kv = await Deno.openKv();
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export interface ConversationState {
  state: string; // e.g. "waiting_for_url"
  data?: Record<string, unknown>;
}

function conversationKey(userId: number): Deno.KvKey {
  return ["conversation", userId];
}

export async function setConversationState(
  userId: number,
  value: ConversationState,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  await kv.set(conversationKey(userId), value, { expireIn: ttlMs });
}

export async function getConversationState(userId: number): Promise<ConversationState | null> {
  const res = await kv.get<ConversationState>(conversationKey(userId));
  return res.value;
}

export async function clearConversationState(userId: number): Promise<void> {
  await kv.delete(conversationKey(userId));
}

// ---- support tickets (spec: anonymous, temporary, no permanent record) -----

const SUPPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createSupportTicket(ticketId: string, userId: number): Promise<void> {
  await kv.set(["support", ticketId], { userId }, { expireIn: SUPPORT_TTL_MS });
}

export async function getSupportTicket(ticketId: string): Promise<{ userId: number } | null> {
  const res = await kv.get<{ userId: number }>(["support", ticketId]);
  return res.value;
}
