# OkapiFind Supabase Security Settings

This document outlines the security settings that need to be configured in the Supabase Dashboard. These settings cannot be configured via SQL migrations.

## Required Manual Configuration

### 1. Leaked Password Protection (CRITICAL)

**Location:** Supabase Dashboard > Authentication > Providers > Email

**Steps:**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Click on **Email** provider settings
4. Enable **"Leaked password protection"**
5. Click **Save**

**What it does:** Checks user passwords against known leaked password databases (HaveIBeenPwned) to prevent users from using compromised passwords.

---

### 2. Multi-Factor Authentication (MFA)

**Location:** Supabase Dashboard > Authentication > Policies

**Steps:**
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Policies**
3. Under **Multi-factor Authentication**, enable desired MFA methods:
   - **TOTP (Authenticator Apps)** - Recommended
   - **Phone (SMS)** - Optional (requires Twilio setup)
4. Configure MFA enforcement level:
   - **Optional** - Users can enable MFA if they want
   - **Required for new users** - All new signups must set up MFA
   - **Required for all users** - All users must have MFA

**Recommended for v1.0:** Enable TOTP as optional. Users who want extra security can enable it.

---

### 3. Rate Limiting (Recommended)

**Location:** Supabase Dashboard > Authentication > Rate Limits

**Steps:**
1. Navigate to **Authentication** > **Rate Limits**
2. Configure the following limits:
   - **Email sign-ups per hour:** 10 (per IP)
   - **SMS OTP requests per hour:** 5 (per phone)
   - **Token refresh per minute:** 30 (per user)
   - **Password recovery per hour:** 5 (per email)

---

### 4. Auth Email Templates

**Location:** Supabase Dashboard > Authentication > Email Templates

**Steps:**
1. Navigate to **Authentication** > **Email Templates**
2. Customize the following templates with OkapiFind branding:
   - **Confirm signup**
   - **Reset password**
   - **Magic link**
   - **Change email address**

---

### 5. URL Configuration

**Location:** Supabase Dashboard > Authentication > URL Configuration

**Steps:**
1. Navigate to **Authentication** > **URL Configuration**
2. Set the following URLs:
   - **Site URL:** `okapifind://` (for mobile deep linking)
   - **Redirect URLs (allowed list):**
     - `okapifind://auth/callback`
     - `okapifind://reset-password`
     - `https://okapifind.com/auth/callback` (if you have a web version)

---

## SQL Security Fixes

The following security issues are fixed by running the migrations in order:

### Migration 1: `001_security_fixes.sql` (Already Applied)
- Creates missing enum types
- Creates extensions schema
- Fixes function search_path
- Enables RLS on all tables

### Migration 2: `20260117160000_security_hardening.sql`
- **Function search_path mutable** - All functions now have `SET search_path = public` to prevent search path injection attacks.
- **RLS Disabled** - Row Level Security is enabled and forced on all user tables.
- **Extensions in public schema** - Created an `extensions` schema for future extension installations.

### Migration 3: `20260117170000_performance_optimization.sql`
- **auth_rls_initplan** - Replaces `auth.uid()` with `(select auth.uid())` in all RLS policies for better query performance.
- **multiple_permissive_policies** - Removes duplicate policies (e.g., `devices_all_own` and `own device rw`).
- **duplicate_index** - Drops duplicate index `devices_user_id_idx` (keeps `idx_devices_user_id`).

### Known Warnings (Cannot Fix)
- **spatial_ref_sys RLS** - This is a PostGIS system table owned by the superuser. Cannot modify.
- **Extensions in public schema** - PostGIS must remain in public schema. This is a low-risk warning.

---

## How to Run the Security Migration

### Option A: Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard > SQL Editor
2. Click **New Query**
3. Copy the contents of `supabase/migrations/20260117160000_security_hardening.sql`
4. Click **Run**
5. Verify the output shows "Security hardening complete!"

### Option B: Supabase CLI

```bash
# From the OkapiFind directory
cd OkapiFind
supabase db push
```

---

## Verification Checklist

After applying all security settings, verify:

- [ ] Run Supabase Database Linter (Database > Linter)
- [ ] All tables show "RLS ON" status
- [ ] All functions show "SECURE" status
- [ ] Leaked password protection is enabled
- [ ] MFA options are configured
- [ ] Rate limits are set
- [ ] Email templates are branded

---

## Security Best Practices

1. **Never disable RLS** on any user-facing table
2. **Use SECURITY DEFINER** sparingly and always with `SET search_path`
3. **Rotate API keys** periodically (Settings > API)
4. **Monitor failed auth attempts** in the Logs section
5. **Keep Supabase CLI updated** for security patches

---

## Contact

For security concerns or questions, contact the OkapiFind development team.
