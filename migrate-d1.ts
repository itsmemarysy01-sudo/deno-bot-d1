// Applies migrations/001_init.sql through D1's REST API directly — no
// wrangler CLI, no Node, just Deno + fetch. (Creating the D1 database
// itself still requires the Cloudflare dashboard or wrangler once, since
// that's Cloudflare-side provisioning — see README "Database setup".)

const accountId = Deno.env.get("CF_ACCOUNT_ID");
const databaseId = Deno.env.get("CF_D1_DATABASE_ID");
const apiToken = Deno.env.get("CF_API_TOKEN");

if (!accountId || !databaseId || !apiToken) {
  console.error("Requires CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN in the environment.");
  Deno.exit(1);
}

const sqlFile = new URL("../migrations/001_init.sql", import.meta.url);
const schema = await Deno.readTextFile(sqlFile);

// Split into individual statements. Good enough for this project's schema
// (no semicolons inside string literals); strips comment lines first.
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const endpoint =
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

for (const sql of statements) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    console.error(`Failed on statement:\n${sql}\n`, data);
    Deno.exit(1);
  }
  console.log(`OK: ${sql.split("\n")[0].slice(0, 60)}...`);
}

console.log("\nMigration complete.");
