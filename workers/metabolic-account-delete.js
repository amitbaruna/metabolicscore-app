// ============================================================================
// Metabolic Score — Account Deletion Worker
// ============================================================================
// Deletes a signed-in user's account entirely: app data in the tables that
// don't cascade automatically, then the Supabase auth user itself (which
// cascades the remaining FK-linked tables, confirmed via a live schema check).
//
// The caller's identity comes ONLY from their own Supabase session token,
// verified server-side against Supabase's own /auth/v1/user endpoint — never
// from a user id passed in the request body or query string.
//
// Required environment variables / secrets (set in Cloudflare dashboard):
//   SUPABASE_URL              — same URL the app uses
//   SUPABASE_ANON_KEY         — publishable key, used only to verify the caller's token
//   SUPABASE_SERVICE_ROLE_KEY — secret key, for the deletes and the Admin Auth call
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Verifies the caller's token against Supabase itself rather than decoding the
// JWT locally — this project's publishable-key setup may sign session tokens
// with a per-project asymmetric key (JWKS), not a single shared HS256 secret,
// so a local decode could silently verify against the wrong scheme.
async function verifyCaller(req, env) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

// Deliberately parses defensively, unlike metabolic-payment-verify.js's
// supabaseFetch — a DELETE commonly comes back 204 with an empty body, and
// calling res.json() directly on that throws "Unexpected end of input".
async function supabaseFetch(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { ok: res.ok, status: res.status, body };
}

async function deleteFrom(env, table, column, userId) {
  const result = await supabaseFetch(env, `/rest/v1/${table}?${column}=eq.${userId}`, { method: 'DELETE' });
  if (!result.ok) return `${table}: ${result.body?.message || result.status}`;
  return null;
}

const DELETE_STEPS = [
  { table: 'app_adaptive_answers', column: 'user_id' },
  { table: 'app_narratives', column: 'user_id' },
  { table: 'app_scores', column: 'user_id' },
  { table: 'app_cravings', column: 'user_id' },
  { table: 'app_profiles', column: 'id' },
];

async function handleDeleteAccount(req, env) {
  const userId = await verifyCaller(req, env);
  if (!userId) return jsonResponse({ error: 'Invalid or expired session', dataDeleted: false }, 401);

  for (const step of DELETE_STEPS) {
    const error = await deleteFrom(env, step.table, step.column, userId);
    if (error) {
      console.error('[account-delete] failed at', step.table, error);
      return jsonResponse({ error: `Failed while deleting ${step.table}. Nothing further was deleted. Your account has not been removed.`, dataDeleted: false }, 500);
    }
  }

  // Admin Auth deleteUser — this is what cascades the remaining FK-linked
  // tables (app_bookings, app_checkins, app_membership, app_nps_ratings,
  // app_referral_codes, app_referrals, app_report_downloads, habit_cycles,
  // notification_log), confirmed via the live schema check.
  const authRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!authRes.ok) {
    const errText = await authRes.text().catch(() => '');
    console.error('[account-delete] admin deleteUser failed:', authRes.status, errText);
    return jsonResponse({ error: 'Your data was deleted, but removing your login failed. Contact support@metabolicscore.in — do not retry, this could affect other accounts.', dataDeleted: true }, 500);
  }

  return jsonResponse({ deleted: true });
}

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    try {
      return await handleDeleteAccount(req, env);
    } catch (e) {
      console.error('[Worker] unhandled error:', e);
      return jsonResponse({ error: 'Internal error' }, 500);
    }
  },
};
