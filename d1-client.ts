// Cloudflare D1 is normally accessed via a Workers binding, which only
// exists inside the Cloudflare Workers runtime. Deno Deploy has no such
// binding, so instead this talks to D1's REST API directly:
//   POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query
// Same SQL, same database — just reached over plain HTTP instead of an
// in-process binding. Every call is a stateless fetch(), so there's no
// connection pool to manage.

import { config } from "../env.ts";

const ENDPOINT =
  `https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/d1/database/${config.cfD1DatabaseId}/query`;

interface D1ApiResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: Array<{ results: Record<string, unknown>[]; success: boolean }>;
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.cfApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 REST API HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as D1ApiResponse;
  if (!data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  }

  return (data.result[0]?.results ?? []) as T[];
}

export async function d1First<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await d1Query<T>(sql, params);
  return rows[0] ?? null;
}

export async function d1Run(sql: string, params: unknown[] = []): Promise<void> {
  await d1Query(sql, params);
}
