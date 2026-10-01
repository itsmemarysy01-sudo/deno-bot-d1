import * as d1 from "../storage/d1.ts";

export async function createContentFromCommand(title: string, body: string) {
  return d1.createContent(title, body);
}

export async function editContentBody(contentId: string, newBody: string) {
  await d1.updateContentBody(contentId, newBody);
}

export function formatContentSummary(content: d1.Content): string {
  return `${content.title}\n\n${content.body}`;
}

export function formatContentList(items: d1.Content[]): string {
  if (items.length === 0) return "No content yet. Create some with /new.";
  return items.map((c) => `• ${c.id} — ${c.title}`).join("\n");
}
