// ============================================================================
// Metabolic Score — Payment Verification Worker
// ============================================================================
// Replaces the fake, client-side-only booking confirmation (TEST_ONLY_confirmBooking)
// with real, server-authoritative payment verification. The app can no longer confirm
// its own payment — only this Worker can, using secrets the app never has access to.
//
// Three endpoints:
//   POST /create-order     — app calls this BEFORE opening Razorpay checkout
//   POST /verify-payment   — app calls this immediately AFTER checkout succeeds
//   POST /webhook          — Razorpay calls this independently, as a safety net in case
//                            the app crashes or loses connection between payment and
//                            calling /verify-payment. Also the ONLY path for payments made
//                            via a manually-sent Razorpay Payment Link (WhatsApp enrollment
//                            flow) — those never touch /create-order or /verify-payment at
//                            all, since there's no in-app order for them to reference.
//
// Both /verify-payment and /webhook do the SAME underlying confirmation, idempotently —
// whichever one fires first wins, the second is a no-op. This means a user gets fast
// confirmation in the normal case (verify-payment, near-instant) but is still protected
// if their app dies right after paying (webhook, arrives within seconds regardless).
//
// Required environment variables / secrets (set in Cloudflare dashboard, never in code):
//   RAZORPAY_KEY_ID       — safe-ish, but keep server-side anyway for consistency
//   RAZORPAY_KEY_SECRET   — NEVER expose client-side
//   RAZORPAY_WEBHOOK_SECRET — generated when you register the webhook URL in Razorpay,
//                             set this AFTER first deploying and getting this Worker's URL
//   SUPABASE_URL          — same URL the app uses
//   SUPABASE_SERVICE_ROLE_KEY — the "Secret key" from Supabase, bypasses RLS
// ============================================================================

// Server-side source of truth for pricing — the app sends a plan type, never a price.
// This is the actual fix for the "never trust client-side price calculations" rule.
const PLAN_PRICES = {
  single_consultation: { amount: 349900, label: 'Single Consultation' }, // in paise (₹3,499.00)
  '90_day_program': { amount: 2499000, label: '90-Day Metabolic Reset' }, // in paise (₹24,990.00)
};

// Razorpay Payment Pages (unlike Standard Links) don't expose a notes field in the dashboard
// UI, so plan_type can't always be tagged at link-creation time the way Standard Links allow.
// Falls back to matching the payment's exact amount against the two known prices — safe
// because there are only ever two fixed prices in this business, never a client-chosen amount.
function planTypeFromAmount(amount) {
  const entry = Object.entries(PLAN_PRICES).find(([, plan]) => plan.amount === amount);
  return entry ? entry[0] : undefined;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function supabaseFetch(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.body ? 'return=representation' : undefined,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

// Persists any captured payment that couldn't be turned into a membership flip, so it's
// visible in Supabase Table Editor instead of only a Cloudflare log line that scrolls away.
// Upserts on razorpay_payment_id so a duplicate webhook delivery for the same payment (Razorpay
// retries on non-2xx, and this Worker always acknowledges with 200 regardless, but duplicate
// deliveries can still happen) doesn't create a second row.
async function logPaymentIssue(env, { paymentId, email, planType, amount, bookingId, reason, rawPayload }) {
  const res = await supabaseFetch(env, '/rest/v1/unmatched_payments?on_conflict=razorpay_payment_id', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      razorpay_payment_id: paymentId,
      email: email || null,
      plan_type: planType || null,
      amount: amount ?? null,
      booking_id: bookingId || null,
      reason,
      raw_payload: rawPayload,
    }),
  });
  if (!Array.isArray(res)) console.warn('[logPaymentIssue] failed to persist unmatched payment:', res);
}

// ----------------------------------------------------------------------------
// POST /create-order — called BEFORE checkout opens
// Body: { plan_type: 'single_consultation' | '90_day_program', booking_id: string,
//         is_upgrade?: boolean }
// booking_id is either a fresh 'held' booking row (normal purchase) or an EXISTING
// confirmed booking being reused as the 90-day kickoff call (is_upgrade: true) — this
// Worker never creates bookings itself, only ever verifies payment against one that
// already exists.
// ----------------------------------------------------------------------------
async function handleCreateOrder(req, env) {
  const { plan_type, booking_id, is_upgrade } = await req.json();
  const plan = PLAN_PRICES[plan_type];
  if (!plan) return jsonResponse({ error: 'Invalid plan_type' }, 400);
  if (!booking_id) return jsonResponse({ error: 'booking_id required' }, 400);

  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: plan.amount,
      currency: 'INR',
      receipt: booking_id,
      // is_upgrade travels with the order into Razorpay's own records, so the webhook path
      // (which only ever sees the payment, not the app's original request) can still tell
      // these two scenarios apart and apply the correct date-anchoring rule.
      notes: { plan_type, booking_id, is_upgrade: is_upgrade ? '1' : '0' },
    }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) {
    console.warn('[create-order] Razorpay order creation failed:', order);
    return jsonResponse({ error: 'Could not create payment order' }, 502);
  }

  return jsonResponse({ order_id: order.id, amount: plan.amount, currency: 'INR', key_id: env.RAZORPAY_KEY_ID });
}

// ----------------------------------------------------------------------------
// The actual confirmation logic — shared by both /verify-payment and /webhook so
// there is exactly one code path that ever marks a booking confirmed. Idempotent:
// safe to call twice for the same booking, second call is a harmless no-op.
//
// Two genuinely different scenarios, not one:
//   - Fresh booking (isUpgrade=false): booking starts 'held', gets confirmed here for the
//     first time. plan_end_date anchors to the call date itself (this call IS the program's
//     own first call, or the single consultation's one call — no offset).
//   - Upgrade-reuse (isUpgrade=true): booking is ALREADY confirmed — it was a single
//     consultation call that already happened as its own engagement. The 90-day clock
//     starts the day AFTER that call, not the call date itself, since that call belonged to
//     a different purchase.
// ----------------------------------------------------------------------------
async function confirmBookingAndMembership(env, bookingId, planType, paymentId, isUpgrade = false) {
  const existing = await supabaseFetch(env, `/rest/v1/app_bookings?id=eq.${bookingId}&select=id,status,user_id,booking_date`);
  if (!Array.isArray(existing) || existing.length === 0) {
    return { ok: false, error: 'Booking not found' };
  }
  const bookingRow = existing[0];

  if (isUpgrade) {
    // Idempotency check — since the booking itself is already 'confirmed' going in (it's
    // being reused, not newly confirmed), we can't use booking status to detect a repeat
    // call the way the fresh path does. Check membership instead.
    const membershipCheck = await supabaseFetch(env, `/rest/v1/app_membership?user_id=eq.${bookingRow.user_id}&select=plan_type,current_booking_id,status`);
    const alreadyUpgraded = Array.isArray(membershipCheck) && membershipCheck[0] &&
      membershipCheck[0].plan_type === '90_day_program' &&
      membershipCheck[0].current_booking_id === bookingId &&
      membershipCheck[0].status === 'paid';
    if (alreadyUpgraded) return { ok: true, alreadyConfirmed: true };

    const existingDate = new Date(bookingRow.booking_date);
    const dayAfter = new Date(existingDate.getFullYear(), existingDate.getMonth(), existingDate.getDate() + 1);
    const planEnd = new Date(dayAfter.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const membershipRes = await supabaseFetch(env, '/rest/v1/app_membership?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: bookingRow.user_id, status: 'paid', plan_type: '90_day_program',
        joined_date: new Date().toISOString(), plan_end_date: planEnd, current_booking_id: bookingId,
      }),
    });
    if (!Array.isArray(membershipRes)) return { ok: false, error: 'Failed to upgrade membership' };
    return { ok: true, alreadyConfirmed: false };
  }

  // Fresh booking path — the normal case
  if (bookingRow.status === 'confirmed') {
    return { ok: true, alreadyConfirmed: true }; // no-op, the other path already did this
  }

  const bookingPatch = await supabaseFetch(env, `/rest/v1/app_bookings?id=eq.${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'confirmed', confirmed_at: new Date().toISOString(), razorpay_payment_id: paymentId }),
  });
  if (!Array.isArray(bookingPatch)) {
    return { ok: false, error: 'Failed to confirm booking' };
  }

  const joined = new Date();
  const callDateStr = bookingRow.booking_date;
  let planEnd;
  if (planType === '90_day_program') {
    const anchor = callDateStr ? new Date(callDateStr) : joined;
    planEnd = new Date(anchor.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    planEnd = new Date(joined.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const membershipRes = await supabaseFetch(env, '/rest/v1/app_membership?on_conflict=user_id', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: bookingRow.user_id, status: 'paid', plan_type: planType,
      joined_date: joined.toISOString(), plan_end_date: planEnd, current_booking_id: bookingId,
    }),
  });
  if (!Array.isArray(membershipRes)) return { ok: false, error: 'Failed to set membership' };

  return { ok: true, alreadyConfirmed: false };
}

// ----------------------------------------------------------------------------
// POST /verify-payment — called by the app right after Razorpay checkout succeeds
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id,
//         plan_type, is_upgrade?: boolean }
// ----------------------------------------------------------------------------
async function handleVerifyPayment(req, env) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id, plan_type, is_upgrade } = await req.json();
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !booking_id || !plan_type) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // This is the actual proof the payment is genuine — Razorpay signs order_id + payment_id
  // with the Key Secret, only Razorpay and this Worker know that secret, so a matching
  // signature can only have come from a real, completed Razorpay payment.
  const expectedSignature = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (expectedSignature !== razorpay_signature) {
    console.warn('[verify-payment] signature mismatch — possible tampering attempt');
    return jsonResponse({ error: 'Invalid payment signature' }, 400);
  }

  const result = await confirmBookingAndMembership(env, booking_id, plan_type, razorpay_payment_id, !!is_upgrade);
  if (!result.ok) return jsonResponse({ error: result.error }, 500);
  return jsonResponse({ confirmed: true });
}

// ----------------------------------------------------------------------------
// POST /webhook — called by Razorpay's own servers, independent of the app.
// Verifies using RAZORPAY_WEBHOOK_SECRET (different from RAZORPAY_KEY_SECRET), which
// only exists once you've registered this Worker's URL in Razorpay's dashboard.
// ----------------------------------------------------------------------------
// For payment links Amit creates manually (via WhatsApp/email, not the app) — these carry the
// buyer's app account email as a note instead of an app-created booking_id, since there's no
// app-side order to reference. Looks up the Supabase user by that email and flips membership
// directly. No booking involved here at all — the person books their actual call afterward,
// once already a member, via the existing free-rebooking flow.
async function confirmMembershipByEmail(env, email, planType, paymentId) {
  // Case-insensitive match — the email Razorpay collects at checkout is whatever the payer
  // typed, which won't always match the casing they signed up with in the app. ilike does
  // the case-folding, but ilike also treats % and _ as wildcards, so any literal % or _ in
  // the email (rare, but technically valid) is escaped first to keep this an exact match
  // apart from case, not a pattern match.
  const escapedEmail = email.replace(/[%_\\]/g, '\\$&');
  const users = await supabaseFetch(env, `/rest/v1/app_profiles?email=ilike.${encodeURIComponent(escapedEmail)}&select=id`);
  if (!Array.isArray(users) || users.length === 0) {
    return { ok: false, error: `No app account found for email: ${email} — they may not have signed up in the app yet` };
  }
  const userId = users[0].id;

  // Idempotency, without relying on a payment-id column that may not exist on this table —
  // if they're already paid on this exact plan, treat a repeat webhook delivery as a no-op
  // rather than re-stamping the join/end dates.
  const existing = await supabaseFetch(env, `/rest/v1/app_membership?user_id=eq.${userId}&select=status,plan_type`);
  if (Array.isArray(existing) && existing[0]?.status === 'paid' && existing[0]?.plan_type === planType) {
    return { ok: true, alreadyConfirmed: true };
  }

  const joined = new Date();
  const planEnd = planType === '90_day_program'
    ? new Date(joined.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(joined.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await supabaseFetch(env, '/rest/v1/app_membership?on_conflict=user_id', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, status: 'paid', plan_type: planType, joined_date: joined.toISOString(), plan_end_date: planEnd }),
  });
  if (!Array.isArray(res)) return { ok: false, error: 'Failed to update membership' };
  return { ok: true, alreadyConfirmed: false };
}

async function handleWebhook(req, env) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) return jsonResponse({ error: 'Missing signature header' }, 400);

  const expectedSignature = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (expectedSignature !== signature) {
    console.warn('[webhook] signature mismatch — request did not genuinely come from Razorpay');
    return jsonResponse({ error: 'Invalid webhook signature' }, 400);
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== 'payment.captured') {
    return jsonResponse({ received: true }); // acknowledge, but nothing to do for other events yet
  }

  const payment = payload.payload.payment.entity;
  const bookingId = payment.notes?.booking_id;
  const planType = payment.notes?.plan_type || planTypeFromAmount(payment.amount);
  // notes.email is a manual override, kept for flexibility, but nothing sets it today —
  // Amit's Payment Links are fixed and reused across every client (see spec: "without
  // generating a custom link per client"), so there's no per-client value he could put into
  // notes at link-creation time. payment.email is the real source of truth: it's what
  // Razorpay itself collects at checkout when "collect email" is enabled on the Payment
  // Link, filled in by the payer, present on every captured payment regardless of notes.
  const email = payment.notes?.email || payment.email;
  const isUpgrade = payment.notes?.is_upgrade === '1';

  // Manual payment link path (WhatsApp/email) — tagged with email, not a booking_id.
  if (email && planType) {
    const result = await confirmMembershipByEmail(env, email, planType, payment.id);
    if (!result.ok) {
      console.warn('[webhook] email-based confirmation failed:', result.error);
      await logPaymentIssue(env, {
        paymentId: payment.id, email, planType, amount: payment.amount, bookingId: null,
        reason: result.error, rawPayload: payment,
      });
    }
    return jsonResponse({ received: true });
  }

  if (!bookingId || !planType) {
    console.warn('[webhook] payment.captured with neither booking_id nor email+plan_type in notes:', payment.id);
    await logPaymentIssue(env, {
      paymentId: payment.id, email: email || null, planType: planType || null, amount: payment.amount,
      bookingId: bookingId || null,
      reason: 'payment.captured had neither booking_id nor email+plan_type to match against',
      rawPayload: payment,
    });
    return jsonResponse({ received: true });
  }

  const result = await confirmBookingAndMembership(env, bookingId, planType, payment.id, isUpgrade);
  if (!result.ok) {
    console.warn('[webhook] confirmation failed:', result.error);
    await logPaymentIssue(env, {
      paymentId: payment.id, email: email || null, planType, amount: payment.amount, bookingId,
      reason: result.error, rawPayload: payment,
    });
  }
  return jsonResponse({ received: true });
}

// ----------------------------------------------------------------------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
      if (url.pathname === '/create-order') return await handleCreateOrder(req, env);
      if (url.pathname === '/verify-payment') return await handleVerifyPayment(req, env);
      if (url.pathname === '/webhook') return await handleWebhook(req, env);
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (e) {
      console.error('[Worker] unhandled error:', e);
      return jsonResponse({ error: 'Internal error' }, 500);
    }
  },
};
