import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://hcksvwxbjcehfxbfgqdo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8P0solsUeueG2VXNWSoujg_UuTImaJH';
export const WORKER_URL = 'https://metabolic-narrative.amit-baruna.workers.dev';
export const PAYMENT_WORKER_URL = 'https://metabolic-payment-verify.amit-baruna.workers.dev';
export const IS_DEMO_MODE = false;

async function doFetch(path: string, options: any, token?: string | null) {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
    ...(options.body ? { 'Prefer': 'return=representation' } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  return { res, data };
}

// Single choke point every API call in this app already goes through. If a request comes back
// with an expired token, silently refresh it using the stored refresh_token and retry the exact
// same request once, transparently — the caller never sees the 401 at all. Only if the refresh
// itself fails (refresh token also expired — a much rarer, longer-lived case) does the original
// error propagate, which correctly means the user needs to log in again.
async function sbFetch(path: string, options: any = {}, token?: string | null) {
  let { res, data } = await doFetch(path, options, token);
  const isExpiredToken = res.status === 401 && !!token && (
    (typeof data?.message === 'string' && data.message.toLowerCase().includes('jwt expired')) ||
    data?.code === 'PGRST303'
  );
  if (isExpiredToken) {
    const newToken = await auth.refreshToken();
    if (newToken) {
      ({ res, data } = await doFetch(path, options, newToken));
    }
  }
  if (!res.ok) {
    console.warn(`[Supabase ${res.status}] ${options.method || 'GET'} ${path}`, 'response:', data, 'request body was:', options.body);
  }
  return data;
}

export const auth = {
  async signUp(email: string, password: string, fullName: string) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, options: { data: { full_name: fullName } } }),
    });
    const data = await res.json();
    if (data.user) {
      await AsyncStorage.setItem('ms_user', JSON.stringify(data.user));
      await AsyncStorage.setItem('ms_token', data.access_token || '');
      await AsyncStorage.setItem('ms_refresh_token', data.refresh_token || '');
      await sbFetch('/rest/v1/app_profiles', {
        method: 'POST',
        body: JSON.stringify({ id: data.user.id, email, full_name: fullName, onboarded: false }),
      }, data.access_token);
    }
    return { user: data.user, error: data.error || null };
  },
  async signIn(email: string, password: string) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.user) {
      await AsyncStorage.setItem('ms_user', JSON.stringify(data.user));
      await AsyncStorage.setItem('ms_token', data.access_token);
      await AsyncStorage.setItem('ms_refresh_token', data.refresh_token || '');
    }
    return { user: data.user, error: data.error || null };
  },
  // Real Google sign-in — exchanges the ID token Google handed back (via expo-auth-session)
  // for an actual Supabase session, same REST pattern as email sign-in above. Replaces the
  // previous fake stub that created a hardcoded local account regardless of what happened.
  async signInWithGoogleToken(idToken: string) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', id_token: idToken }),
    });
    const data = await res.json();
    if (data.user) {
      await AsyncStorage.setItem('ms_user', JSON.stringify(data.user));
      await AsyncStorage.setItem('ms_token', data.access_token);
      await AsyncStorage.setItem('ms_refresh_token', data.refresh_token || '');
    }
    return { user: data.user, error: data.error || null };
  },
  async signOut() {
    await AsyncStorage.removeItem('ms_user');
    await AsyncStorage.removeItem('ms_token');
    await AsyncStorage.removeItem('ms_refresh_token');
  },
  async getSession() {
    const user = await AsyncStorage.getItem('ms_user');
    return user ? JSON.parse(user) : null;
  },
  async getToken() {
    return await AsyncStorage.getItem('ms_token');
  },
  // Exchanges the stored refresh_token for a fresh access_token. Returns null (never throws) so
  // sbFetch can just check truthiness — a null means "refresh token itself is gone/invalid,"
  // which correctly falls through to the original 401 and a real re-login.
  async refreshToken(): Promise<string | null> {
    const refreshToken = await AsyncStorage.getItem('ms_refresh_token');
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        console.warn('[auth.refreshToken] refresh failed — user will need to log in again:', data);
        return null;
      }
      await AsyncStorage.setItem('ms_token', data.access_token);
      if (data.refresh_token) await AsyncStorage.setItem('ms_refresh_token', data.refresh_token);
      return data.access_token;
    } catch (e) {
      console.warn('[auth.refreshToken] threw:', e);
      return null;
    }
  },
};

export const profiles = {
  async get(userId: string) {
    const token = await auth.getToken();
    return await sbFetch(`/rest/v1/app_profiles?id=eq.${userId}&select=*`, {}, token);
  },
  async upsert(profile: any) {
    const token = await auth.getToken();
    await AsyncStorage.setItem('ms_profile', JSON.stringify(profile));
    return await sbFetch('/rest/v1/app_profiles', {
      method: 'POST',
      headers: { ...token ? { 'Authorization': `Bearer ${token}` } : {}, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(profile),
    }, token);
  },
  async updateFields(userId: string, fields: Record<string, any>) {
    const token = await auth.getToken();
    const cached = await AsyncStorage.getItem('ms_profile');
    if (cached) {
      try {
        const merged = { ...JSON.parse(cached), ...fields };
        await AsyncStorage.setItem('ms_profile', JSON.stringify(merged));
      } catch { /* ignore */ }
    }
    const tryPatch = async (f: Record<string, any>) => {
      return await sbFetch(`/rest/v1/app_profiles?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(f),
      }, token);
    };
    const result = await tryPatch(fields);
    const hasColumnError = (result?.code === 'PGRST204' || result?.code === '42703') ||
      (typeof result?.message === 'string' && (result.message.includes('mini_quiz') || result.message.includes('column')));
    if (hasColumnError) {
      const SAFE_COLUMNS = ['full_name', 'email', 'age', 'gender', 'conditions', 'onboarded', 'symptoms', 'goals', 'fat_deposition', 'baseline'];
      const safeFields: Record<string, any> = {};
      for (const key of Object.keys(fields)) {
        if (SAFE_COLUMNS.includes(key)) safeFields[key] = fields[key];
      }
      if (Object.keys(safeFields).length > 0) return await tryPatch(safeFields);
    }
    return result;
  },
};

export const scores = {
  async save(payload: any) {
    const token = await auth.getToken();
    const user = await auth.getSession();
    await AsyncStorage.setItem('ms_has_score', 'true');
    const trySave = async (p: any) => {
      return await sbFetch('/rest/v1/app_scores', {
        method: 'POST',
        body: JSON.stringify({ user_id: user?.id, ...p }),
      }, token);
    };
    const result = await trySave(payload);
    const isErrorResponse = (r: any) => r && (r.code || r.error || (r.message && !Array.isArray(r)));
    if (isErrorResponse(result)) {
      console.warn('[scores.save] first attempt failed:', result);
      const isAnswersError = (result?.code === 'PGRST204' || result?.code === '42703') ||
        (typeof result?.message === 'string' && result.message.includes('answers'));
      if (isAnswersError) {
        const { answers, ...payloadWithoutAnswers } = payload;
        const retryResult = await trySave(payloadWithoutAnswers);
        if (isErrorResponse(retryResult)) console.error('[scores.save] retry also failed:', retryResult);
        return retryResult;
      }
    }
    return result;
  },
  async list(userId: string) {
    const token = await auth.getToken();
    return await sbFetch(`/rest/v1/app_scores?user_id=eq.${userId}&select=*&order=created_at.desc`, {}, token);
  },
};

export const booking = {
  async getTemplate() {
    const res = await sbFetch('/rest/v1/booking_availability_template?is_active=eq.true&order=day_of_week,start_time');
    if (!Array.isArray(res)) console.warn('[booking.getTemplate] unexpected response:', res);
    return res;
  },
  async getExceptions(fromDate: string, toDate: string) {
    const res = await sbFetch(`/rest/v1/booking_exceptions?exception_date=gte.${fromDate}&exception_date=lte.${toDate}`);
    if (!Array.isArray(res)) console.warn('[booking.getExceptions] unexpected response:', res);
    return res;
  },
  async getBookedSlots(fromDate: string, toDate: string) {
    const res = await sbFetch(`/rest/v1/app_bookings?booking_date=gte.${fromDate}&booking_date=lte.${toDate}&status=in.(held,confirmed)&select=template_slot_id,booking_date,status,hold_expires_at`);
    if (!Array.isArray(res)) console.warn('[booking.getBookedSlots] unexpected response (likely needs the public-read policy — see follow-up SQL):', res);
    return res;
  },
  async createHold(payload: { user_id: string; template_slot_id: string; booking_date: string; hold_expires_at: string }) {
    const token = await auth.getToken();
    return await sbFetch('/rest/v1/app_bookings', { method: 'POST', body: JSON.stringify({ ...payload, status: 'held' }) }, token);
  },
  // For users whose membership is already active/paid but have no current booked call —
  // e.g., after cancelling. Creates a booking directly as 'confirmed', skipping the
  // hold→payment→verify flow entirely, since payment was already made for the plan itself,
  // not per-call. Safe under RLS (auth.uid() = user_id), no server-side verification needed
  // since no money changes hands here.
  async createFreeRebooking(payload: { user_id: string; template_slot_id: string; booking_date: string }) {
    const token = await auth.getToken();
    // hold_expires_at is NOT NULL on this table even though it's meaningless for an
    // already-confirmed booking — set it to now, satisfying the constraint without
    // implying any actual hold/expiry behavior applies.
    return await sbFetch('/rest/v1/app_bookings', { method: 'POST', body: JSON.stringify({ ...payload, status: 'confirmed', confirmed_at: new Date().toISOString(), hold_expires_at: new Date().toISOString() }) }, token);
  },
  async rescheduleBooking(bookingId: string, newTemplateSlotId: string, newBookingDate: string) {
    const token = await auth.getToken();
    const res = await sbFetch(`/rest/v1/app_bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ template_slot_id: newTemplateSlotId, booking_date: newBookingDate }),
    }, token);
    if (!Array.isArray(res)) {
      console.warn('[booking.rescheduleBooking] unexpected response:', res);
    }
    return res;
  },
  // Genuine cancellation — distinct from reschedule. Marks the booking cancelled rather than
  // moving it, freeing up the slot for other users without requiring the person to pick a new
  // time first.
  async cancelBooking(bookingId: string) {
    const token = await auth.getToken();
    const res = await sbFetch(`/rest/v1/app_bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    }, token);
    if (!Array.isArray(res)) {
      console.warn('[booking.cancelBooking] unexpected response:', res);
    }
    return res;
  },
  // TEMPORARY — for testing only, until the Razorpay webhook + Cloudflare Worker is live tomorrow.
  // This lets the app mark a booking as paid/confirmed from the client after returning from the
  // external Razorpay link. This is NOT trustworthy (anyone could call it without paying) and
  // MUST be removed once the real webhook confirmation path replaces it.
  //
  // Used for FRESH purchases only — the booking being confirmed here IS the kickoff call itself.
  // Date anchoring: single_consultation gets a 7-day window from the day they joined (not tied to
  // the call date — the call happens sometime within that window). 90_day_program anchors to the
  // call date itself, no offset, since this is the program's own first call.
  async TEST_ONLY_confirmBooking(bookingId: string, planType: 'single_consultation' | '90_day_program') {
    const token = await auth.getToken();
    const user = await auth.getSession();
    const bookingPatchRes = await sbFetch(`/rest/v1/app_bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' } as any,
      body: JSON.stringify({ status: 'confirmed', confirmed_at: new Date().toISOString() }),
    }, token);
    if (!Array.isArray(bookingPatchRes) || !bookingPatchRes[0]) {
      console.warn('[TEST_ONLY_confirmBooking] booking PATCH failed or returned nothing — booking may still show as old/held:', bookingPatchRes);
    }
    const joined = new Date();
    const callDateStr = bookingPatchRes?.[0]?.booking_date; // e.g. "2026-07-25"
    let planEnd: string | null = null;
    if (planType === '90_day_program') {
      const anchor = callDateStr ? new Date(callDateStr) : joined;
      planEnd = new Date(anchor.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // single_consultation: 7-day window from the join/purchase date, not from the call date
      planEnd = new Date(joined.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    const membershipRes = await sbFetch('/rest/v1/app_membership?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' } as any,
      body: JSON.stringify({ user_id: user?.id, status: 'paid', plan_type: planType, joined_date: joined.toISOString(), plan_end_date: planEnd, current_booking_id: bookingId }),
    }, token);
    if (!Array.isArray(membershipRes)) {
      console.warn('[TEST_ONLY_confirmBooking] membership upsert failed:', membershipRes);
    }
    return { booking: bookingPatchRes, membership: membershipRes };
  },
  // TEMPORARY — same caveats as TEST_ONLY_confirmBooking above.
  // Used when a user who ALREADY has a confirmed call (from a single consultation) buys the 90-day
  // program. Their existing call becomes the program's kickoff call — no new booking is created, no
  // slot picker is shown. Date anchoring: the day AFTER the existing call's date, since that call
  // already happened as its own (single-consultation) engagement — the 90-day clock starts fresh
  // the day after, not the day of a call that belonged to a different purchase.
  async TEST_ONLY_confirmProgramUpgrade(existingBookingId: string, existingBookingDate: string) {
    const token = await auth.getToken();
    const user = await auth.getSession();
    const joined = new Date();
    const existingDate = new Date(existingBookingDate);
    const dayAfter = new Date(existingDate.getFullYear(), existingDate.getMonth(), existingDate.getDate() + 1);
    const planEnd = new Date(dayAfter.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const membershipRes = await sbFetch('/rest/v1/app_membership?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' } as any,
      body: JSON.stringify({ user_id: user?.id, status: 'paid', plan_type: '90_day_program', joined_date: joined.toISOString(), plan_end_date: planEnd, current_booking_id: existingBookingId }),
    }, token);
    if (!Array.isArray(membershipRes)) {
      console.warn('[TEST_ONLY_confirmProgramUpgrade] membership upsert failed:', membershipRes);
    }
    return { membership: membershipRes };
  },
  async getMyBooking() {
    const user = await auth.getSession();
    if (!user?.id) return null; // session hasn't loaded yet — this is a normal, expected moment
    // right after app start, not an error; the caller's effect will re-run once it has, and
    // firing the request anyway just produces a confusing 400 with "undefined" in the URL.
    const token = await auth.getToken();
    const rows = await sbFetch(`/rest/v1/app_bookings?user_id=eq.${user.id}&status=eq.confirmed&order=created_at.desc&limit=1&select=id,booking_date,status,template_slot_id,booking_availability_template(start_time,end_time)`, {}, token);
    if (!Array.isArray(rows)) {
      console.warn('[booking.getMyBooking] unexpected response (not an array):', rows);
      return null;
    }
    return rows[0] || null;
  },
};

export const referral = {
  async getOrCreateCode(): Promise<string | null> {
    const token = await auth.getToken();
    const user = await auth.getSession();
    if (!user?.id) return null;
    const existing = await sbFetch(`/rest/v1/app_referral_codes?user_id=eq.${user.id}`, {}, token);
    if (Array.isArray(existing) && existing[0]?.code) return existing[0].code;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const res = await sbFetch('/rest/v1/app_referral_codes', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, code }),
    }, token);
    const row = Array.isArray(res) ? res[0] : null;
    return row?.code || code;
  },
  async recordSignup(referralCode: string) {
    try {
      const token = await auth.getToken();
      const user = await auth.getSession();
      if (!user?.id || !referralCode) return;
      const codeRows = await sbFetch(`/rest/v1/app_referral_codes?code=eq.${referralCode.trim().toUpperCase()}`, {}, token);
      const referrerId = Array.isArray(codeRows) && codeRows[0]?.user_id;
      if (!referrerId || referrerId === user.id) return; // invalid code or self-referral
      await sbFetch('/rest/v1/app_referrals', {
        method: 'POST',
        body: JSON.stringify({ referrer_user_id: referrerId, referred_user_id: user.id, referral_code: referralCode.trim().toUpperCase(), status: 'signed_up' }),
      }, token);
    } catch (e) { console.warn('[referral.recordSignup] failed:', e); }
  },
  async markQuizCompleted() {
    try {
      const token = await auth.getToken();
      const user = await auth.getSession();
      if (!user?.id) return;
      await sbFetch(`/rest/v1/app_referrals?referred_user_id=eq.${user.id}&status=eq.signed_up`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'quiz_completed', completed_at: new Date().toISOString() }),
      }, token);
    } catch (e) { console.warn('[referral.markQuizCompleted] failed:', e); }
  },
  async getMyStats() {
    const token = await auth.getToken();
    const user = await auth.getSession();
    if (!user?.id) return { totalReferred: 0, successfulReferrals: 0 };
    const rows = await sbFetch(`/rest/v1/app_referrals?referrer_user_id=eq.${user.id}&select=status`, {}, token);
    const list = Array.isArray(rows) ? rows : [];
    return { totalReferred: list.length, successfulReferrals: list.filter((r: any) => r.status === 'quiz_completed').length };
  },
};

// Push notification registration — saves the device's Expo push token against the user's
// profile. This is the app-side half only. Actually SENDING scheduled notifications (Day 3/7/14
// reminders, weekly insights) needs a separate server-side piece — a scheduled Worker that reads
// these tokens and calls Expo's push API — which does not exist yet. This function just makes
// sure a token is captured and stored once someone grants permission, so that Worker has
// something to read from once it's built.
export const pushNotifications = {
  async saveToken(userId: string, token: string) {
    const authToken = await auth.getToken();
    const res = await sbFetch(`/rest/v1/app_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ push_token: token }),
    }, authToken);
    if (!Array.isArray(res)) {
      console.warn('[pushNotifications.saveToken] unexpected response — the push_token column may not exist yet on app_profiles:', res);
    }
    return res;
  },
};

export const membership = {
  async get() {
    const user = await auth.getSession();
    if (!user?.id) return { status: 'trial' }; // session not loaded yet — same as booking.getMyBooking
    const token = await auth.getToken();
    const rows = await sbFetch(`/rest/v1/app_membership?user_id=eq.${user.id}`, {}, token);
    if (!Array.isArray(rows)) {
      console.warn('[membership.get] unexpected response (not an array) — falling back to trial:', rows);
      return { status: 'trial' };
    }
    return rows[0] || { status: 'trial' };
  },
};

export const nps = {
  async save(payload: { score: number; total_score?: number | null; dominant_layer?: number | null }) {
    const token = await auth.getToken();
    const user = await auth.getSession();
    return await sbFetch('/rest/v1/app_nps_ratings', {
      method: 'POST',
      body: JSON.stringify({ user_id: user?.id, ...payload }),
    }, token);
  },
};

export const cravings = {
  async save(payload: any) {
    const token = await auth.getToken();
    const user = await auth.getSession();
    return await sbFetch('/rest/v1/app_cravings', {
      method: 'POST',
      body: JSON.stringify({ user_id: user?.id, ...payload }),
    }, token);
  },
  async update(id: string, payload: any) {
    const token = await auth.getToken();
    return await sbFetch(`/rest/v1/app_cravings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token);
  },
  async list(userId: string, limit = 100) {
    const token = await auth.getToken();
    return await sbFetch(`/rest/v1/app_cravings?user_id=eq.${userId}&select=*&order=created_at.desc&limit=${limit}`, {}, token);
  },
};

// Real payment verification — calls the deployed Cloudflare Worker, replacing the old
// TEST_ONLY_confirmBooking / TEST_ONLY_confirmProgramUpgrade client-side-only confirmation.
// The app can no longer confirm its own payment; only the Worker can, using secrets
// (Razorpay Key Secret, Supabase service role) the app never has access to.
export const payment = {
  // Called BEFORE opening Razorpay checkout. Server-side pricing — the app only ever sends
  // which plan, never an amount, so a tampered client can't request a discount.
  async createOrder(planType: 'single_consultation' | '90_day_program', bookingId: string, isUpgrade = false) {
    const res = await fetch(`${PAYMENT_WORKER_URL}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_type: planType, booking_id: bookingId, is_upgrade: isUpgrade }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[payment.createOrder] failed:', data);
      return null;
    }
    return data as { order_id: string; amount: number; currency: string; key_id: string };
  },
  // Called immediately after Razorpay's native checkout SDK returns a successful payment.
  // The Worker independently verifies the cryptographic signature before confirming anything
  // — this call proves nothing on its own, the Worker's verification is the real gate.
  async verifyPayment(params: {
    razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string;
    booking_id: string; plan_type: string; is_upgrade?: boolean;
  }) {
    const res = await fetch(`${PAYMENT_WORKER_URL}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[payment.verifyPayment] failed:', data);
      return { confirmed: false, error: data?.error };
    }
    return { confirmed: true };
  },
};

// DPDP account deletion. Deletes the user's own rows from every table, under the same RLS
// policies already verified for each (auth.uid() = user_id / id) — these DELETE calls only work
// because the user is deleting their own data, same trust boundary as everything else they do.
//
// IMPORTANT LIMITATION: this does NOT remove the underlying auth.users record itself — that
// requires Supabase's admin API, which needs the service-role key. That key must never be
// bundled in client code, so this genuinely cannot be completed purely client-side. Until a
// server-side endpoint exists for that final step, the UI must say so honestly rather than
// claim full account removal — see the confirmation copy in ComplianceScreen.
export const account = {
  async deleteMyData(): Promise<{ ok: boolean; errors: string[] }> {
    const token = await auth.getToken();
    const user = await auth.getSession();
    if (!user?.id) return { ok: false, errors: ['Not signed in'] };
    const errors: string[] = [];
    const del = async (label: string, path: string) => {
      const res = await sbFetch(path, { method: 'DELETE' }, token);
      if (res && (res.code || res.error)) errors.push(`${label}: ${res.message || res.code}`);
    };
    await del('scores', `/rest/v1/app_scores?user_id=eq.${user.id}`);
    await del('cravings', `/rest/v1/app_cravings?user_id=eq.${user.id}`);
    await del('bookings', `/rest/v1/app_bookings?user_id=eq.${user.id}`);
    await del('membership', `/rest/v1/app_membership?user_id=eq.${user.id}`);
    await del('referrals (as referrer)', `/rest/v1/app_referrals?referrer_user_id=eq.${user.id}`);
    await del('referrals (as referred)', `/rest/v1/app_referrals?referred_user_id=eq.${user.id}`);
    await del('referral code', `/rest/v1/app_referral_codes?user_id=eq.${user.id}`);
    await del('nps ratings', `/rest/v1/app_nps_ratings?user_id=eq.${user.id}`);
    // Profile last — it's the row RLS/other tables' history conceptually hang off, delete it once
    // everything else is gone. Uses id, not user_id, per app_profiles' own schema.
    await del('profile', `/rest/v1/app_profiles?id=eq.${user.id}`);
    // Local device data — symptoms/goals/baseline live in app_profiles.symptoms JSON (just
    // deleted above), but streak history and cached profile are device-local, clear those too.
    await AsyncStorage.multiRemove(['ms_action_done_dates', 'ms_action_done_today', 'ms_profile', 'ms_domino_ever_shown', 'ms_domino_last_date', 'ms_domino_last_idx']).catch(() => {});
    await auth.signOut();
    return { ok: errors.length === 0, errors };
  },
};
