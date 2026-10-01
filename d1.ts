// Same minimal schema as before (see migrations/001_init.sql): content the
// owner creates, buttons, published-message identifiers, optional
// scheduled tasks. Queries now go through the D1 REST client.

import { d1First, d1Query, d1Run } from "./d1-client.ts";

export interface Content {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface ButtonRow {
  id: string;
  contentId: string;
  text: string;
  url: string;
  position: number;
}

export interface PublishedMessage {
  id: string;
  contentId: string;
  chatId: number;
  messageId: number;
}

export interface ScheduledTask {
  id: string;
  contentId: string;
  chatIds: number[];
  runAt: number;
  status: "pending" | "done" | "failed";
}

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

// ---- content ----------------------------------------------------------------

export async function createContent(title: string, body: string): Promise<Content> {
  const id = newId("content");
  const now = Date.now();
  await d1Run(
    `INSERT INTO content (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, title, body, now, now],
  );
  return { id, title, body, createdAt: now, updatedAt: now };
}

export async function updateContentBody(id: string, body: string): Promise<void> {
  await d1Run(`UPDATE content SET body = ?, updated_at = ? WHERE id = ?`, [body, Date.now(), id]);
}

export async function getContent(id: string): Promise<Content | null> {
  const row = await d1First<any>(`SELECT * FROM content WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContent(limit = 20): Promise<Content[]> {
  const rows = await d1Query<any>(
    `SELECT * FROM content ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ---- buttons ------------------------------------------------------------------

export async function addButton(
  contentId: string,
  text: string,
  url: string,
  position = 0,
): Promise<ButtonRow> {
  const id = newId("button");
  const now = Date.now();
  await d1Run(
    `INSERT INTO buttons (id, content_id, text, url, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, contentId, text, url, position, now, now],
  );
  return { id, contentId, text, url, position };
}

export async function listButtons(contentId: string): Promise<ButtonRow[]> {
  const rows = await d1Query<any>(
    `SELECT * FROM buttons WHERE content_id = ? ORDER BY position`,
    [contentId],
  );
  return rows.map((row) => ({
    id: row.id,
    contentId: row.content_id,
    text: row.text,
    url: row.url,
    position: row.position,
  }));
}

export async function updateButtonUrl(buttonId: string, url: string): Promise<void> {
  await d1Run(`UPDATE buttons SET url = ?, updated_at = ? WHERE id = ?`, [
    url,
    Date.now(),
    buttonId,
  ]);
}

export async function getButton(buttonId: string): Promise<ButtonRow | null> {
  const row = await d1First<any>(`SELECT * FROM buttons WHERE id = ?`, [buttonId]);
  if (!row) return null;
  return {
    id: row.id,
    contentId: row.content_id,
    text: row.text,
    url: row.url,
    position: row.position,
  };
}

// ---- published_messages ---------------------------------------------------------

export async function recordPublishedMessage(
  contentId: string,
  chatId: number,
  messageId: number,
): Promise<void> {
  const id = newId("pub");
  const now = Date.now();
  await d1Run(
    `INSERT INTO published_messages (id, content_id, chat_id, message_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, contentId, chatId, messageId, now, now],
  );
}

export async function listPublishedMessages(contentId: string): Promise<PublishedMessage[]> {
  const rows = await d1Query<any>(`SELECT * FROM published_messages WHERE content_id = ?`, [
    contentId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    contentId: row.content_id,
    chatId: row.chat_id,
    messageId: row.message_id,
  }));
}

// ---- scheduled_tasks --------------------------------------------------------------

export async function scheduleTask(
  contentId: string,
  chatIds: number[],
  runAt: number,
): Promise<ScheduledTask> {
  const id = newId("sched");
  const now = Date.now();
  await d1Run(
    `INSERT INTO scheduled_tasks (id, content_id, chat_ids, run_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [id, contentId, JSON.stringify(chatIds), runAt, now, now],
  );
  return { id, contentId, chatIds, runAt, status: "pending" };
}

export async function listDueTasks(now: number): Promise<ScheduledTask[]> {
  const rows = await d1Query<any>(
    `SELECT * FROM scheduled_tasks WHERE status = 'pending' AND run_at <= ?`,
    [now],
  );
  return rows.map((row) => ({
    id: row.id,
    contentId: row.content_id,
    chatIds: JSON.parse(row.chat_ids),
    runAt: row.run_at,
    status: row.status,
  }));
}

export async function markTaskStatus(
  taskId: string,
  status: "done" | "failed",
): Promise<void> {
  await d1Run(`UPDATE scheduled_tasks SET status = ?, updated_at = ? WHERE id = ?`, [
    status,
    Date.now(),
    taskId,
  ]);
}
