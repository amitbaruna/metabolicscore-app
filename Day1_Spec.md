# Day 1 Spec — Session Refresh + Real Payment Flow

Read `CLAUDE.md` first for standing rules. This spec covers two independent pieces of
work — implement and test each separately, don't mix commits.

---

## Part A — Session Token Refresh

**Problem:** No mechanism renews the login session. After ~1hr, every authenticated
action (saving scores, symptoms, cravings, profile updates) silently fails with a
401 "JWT expired" and no error shown to the user.

**Before writing anything:** audit `src/config/supabase.ts`. A prior review found what
looked like partial handling already present (`isExpiredToken` checks, an
`auth.refreshToken()` function). Confirm whether this exists, whether it's complete, and
whether it's actually invoked on every 401 across `sbFetch` — close real gaps rather than
rebuilding from scratch.

**If missing or incomplete, build:**
1. On login (both email/password and Google), store the `refresh_token` returned by
   Supabase (likely already saved as `ms_refresh_token` — confirm).
2. In `sbFetch`, detect a 401 / "JWT expired" response.
3. On detection: silently call Supabase's token refresh endpoint using the stored
   refresh token, get a new access token, update stored `ms_token`, retry the original
   request once with the new token.
4. If refresh itself fails (refresh token also expired/invalid): sign the user out
   cleanly and route to login — don't leave the app in a broken silent state.

**Test:** stay signed in for over an hour, then perform an action requiring a save
(log a craving, update profile). Should succeed without a manual re-login. Confirm via
console logs that a refresh actually happened.

---

## Part B — Real Payment Flow (WhatsApp redirect + Razorpay webhook + membership flip)

**Current state:** "Enroll"/"Talk to Amit" buttons show pricing (₹3,499 single
consultation, ₹24,990 90-day program) but redirect to WhatsApp with no real
confirmation flow — payment status never reflects in the app afterward.

**Target flow:**
1. User taps Enroll (either program) → deep-links to Amit's WhatsApp Business number
   via a `wa.me` link, **pre-filled with the user's registered email and which specific
   program they selected** (name + price), so Amit knows exactly what to send.
2. Amit manually replies with the correct Razorpay Payment Link for that program
   (existing manual process — no change here this sprint).
3. **The Razorpay Payment Link must require the payer to enter their email at
   checkout** (Razorpay Payment Links support this as a built-in option — confirm exact
   config in Razorpay's dashboard). This is what makes automatic matching possible
   without generating a custom link per client.
4. Client pays → Razorpay fires a `payment_link.paid` (or equivalent captured-payment)
   webhook → hits the Cloudflare Worker endpoint.
5. **Worker verifies the webhook signature** using the Razorpay webhook secret
   (HMAC-SHA256 over the raw request body, checked against the `X-Razorpay-Signature`
   header) before trusting anything in the payload. Never process an unverified webhook.
6. Worker extracts the payer's email from the payload and looks up a matching row in
   `app_profiles`.
   - **Match found:** flip the client's membership status/tier in Supabase (define the
     exact field — e.g. `membership_tier`, `membership_active`, which program, purchase
     date). App should reflect this on next open/refresh — show "Pro Member" (or
     similar) and unlock call booking.
   - **No match found (typo'd email, different account, Google-login email mismatch,
     etc.):** do NOT silently drop the payment. Log it (a small `unmatched_payments`
     table, or an email/notification to Amit) with the payment details so it can be
     manually resolved by editing the client's row directly in Supabase's Table Editor.
     No dashboard UI needed for this yet — manual fix via Supabase is fine for now.

**Explicitly out of scope for this sprint** (confirmed with Amit, defer to v1.1):
- Any dashboard UI for manually flipping membership/searching clients — Supabase Table
  Editor is the manual fallback for now.
- Account migration / merging tooling for email mismatches.
- Automated WhatsApp replies (Business API/BSP) — this sprint stays fully manual on
  Amit's side for the WhatsApp portion.

**Test before considering this done:**
- Full flow once in Razorpay **test mode** first: tap Enroll → WhatsApp opens with
  correct pre-filled program + email → simulate a test payment with matching email →
  confirm membership flips in Supabase → confirm app shows it after refresh.
- Test the no-match path deliberately (pay with an email that doesn't exist in
  `app_profiles`) → confirm it's logged/flagged, not silently lost.
- Only after both pass cleanly: switch Razorpay to live mode and point the Worker at
  the live webhook secret.
