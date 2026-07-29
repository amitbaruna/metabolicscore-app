// Schema-drift check: compares scripts/schema-manifest.ts (the columns the app actually
// sends) against the real Supabase schema, so a missing/renamed column is caught before it
// causes a silent save failure at runtime. This bug class has already cost three separate
// debugging sessions — see CLAUDE.md's 2026-07-25/29 session log entries.
//
// Usage: npm run schema:check
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. via a local
// .env file — never hardcoded, never committed).
//
// Implementation note: this queries PostgREST's self-describing OpenAPI schema endpoint
// (GET /rest/v1/ with Accept: application/openapi+json), not information_schema.columns
// directly — information_schema isn't exposed over the REST API even with the service role
// key, since PostgREST only exposes the schemas configured in db-schema (normally just
// `public`). The OpenAPI endpoint is PostgREST's own introspection of that same schema, so
// it reports the same real column existence; it's just reachable with the REST credentials
// this script is told to use instead of a raw Postgres connection string.

import 'dotenv/config';
import { SCHEMA_MANIFEST } from './schema-manifest';

type OpenApiSchema = {
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
};

async function fetchLiveSchema(supabaseUrl: string, serviceRoleKey: string): Promise<Record<string, string[]>> {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/openapi+json',
    },
  });
  if (!res.ok) {
    throw new Error(`PostgREST schema endpoint returned ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as OpenApiSchema;
  const definitions = body.definitions || {};
  const tables: Record<string, string[]> = {};
  for (const [tableName, def] of Object.entries(definitions)) {
    tables[tableName] = Object.keys(def.properties || {});
  }
  return tables;
}

function printHeader(text: string) {
  console.log('');
  console.log(text);
  console.log('='.repeat(text.length));
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[schema:check] Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in the environment.');
    console.error('[schema:check] Add them to a local .env file (gitignored) and re-run.');
    process.exitCode = 1;
    return;
  }

  console.log('[schema:check] Fetching live Supabase schema...');
  let liveSchema: Record<string, string[]>;
  try {
    liveSchema = await fetchLiveSchema(SUPABASE_URL, SERVICE_ROLE_KEY);
  } catch (e) {
    console.error('[schema:check] Failed to fetch schema from Supabase:', e);
    process.exitCode = 1;
    return;
  }

  printHeader('Schema Drift Check');

  let hasHardFailure = false;
  const tableNames = Object.keys(SCHEMA_MANIFEST).sort();

  for (const tableName of tableNames) {
    const manifest = SCHEMA_MANIFEST[tableName];
    const liveColumns = liveSchema[tableName];

    console.log('');
    console.log(`Table: ${tableName}`);

    if (!liveColumns) {
      console.log(`  ✗ TABLE NOT FOUND in Supabase (or not exposed via REST).`);
      if (manifest.columns.length > 0) {
        console.log(`    App sends ${manifest.columns.length} column(s) to a table that doesn't exist: ${manifest.columns.join(', ')}`);
        hasHardFailure = true;
      } else {
        console.log(`    (Manifest lists no app-sent columns for this table — see schema-manifest.ts's "source" note.)`);
      }
      continue;
    }

    const liveSet = new Set(liveColumns);
    const missingInDb = manifest.columns.filter(c => !liveSet.has(c));

    if (missingInDb.length > 0) {
      console.log(`  ✗ MISSING IN DB — app sends these but they don't exist as columns: ${missingInDb.join(', ')}`);
      hasHardFailure = true;
    } else if (manifest.columns.length > 0) {
      console.log(`  ✓ All ${manifest.columns.length} app-sent column(s) exist in the DB.`);
    } else {
      console.log(`  (No app-sent columns to check — see schema-manifest.ts's "source" note for why.)`);
    }

    // Only flag unused DB columns for tables the app actually writes to at all — for
    // intentionally app-write-free tables (empty manifest, e.g. app_membership) every real
    // column would trigger this and it wouldn't mean anything.
    if (manifest.columns.length > 0) {
      const sentSet = new Set(manifest.columns);
      const neverSent = liveColumns.filter(c => !sentSet.has(c));
      if (neverSent.length > 0) {
        console.log(`  ⚠ ${neverSent.length} DB column(s) the app never sends (possibly dead/legacy): ${neverSent.join(', ')}`);
      }
    }
  }

  printHeader('Summary');
  if (hasHardFailure) {
    console.log('✗ Schema drift detected — see MISSING IN DB entries above. Fix the mismatch before it causes a silent save failure.');
    process.exitCode = 1;
  } else {
    console.log('✓ No missing columns. All app-sent fields exist in the live schema.');
    process.exitCode = 0;
  }
}

main();
