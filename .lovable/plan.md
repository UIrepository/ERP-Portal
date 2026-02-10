

# Fix: Email Notifications Not Sending (Vault Permission Issue)

## Root Cause
The `notify_via_google_group` function tries to read the Resend API key from `vault.decrypted_secrets`, but the `postgres` role (which owns the SECURITY DEFINER function) does not have permission to decrypt vault secrets. This causes a silent failure -- the function hits the `RESEND_API_KEY not found` warning and skips sending.

The Postgres error log confirms: `permission denied for function _crypto_aead_det_decrypt`

## Fix

Since the Vault decryption is not accessible from trigger functions in this Supabase setup, we'll use an alternative approach: store the API key in a **private config table** that only the `postgres` role can read.

### Step 1: Create a private config table
Create a simple `app_secrets` table in a private schema to store key-value pairs. Only the `postgres` role (used by SECURITY DEFINER functions) will have access -- no RLS policies for public access.

```sql
CREATE TABLE IF NOT EXISTS private.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Restrict access to postgres only
REVOKE ALL ON private.app_secrets FROM public, anon, authenticated;
```

### Step 2: Insert the Resend API key
```sql
INSERT INTO private.app_secrets (key, value)
VALUES ('RESEND_API_KEY', 'YOUR_ACTUAL_KEY_HERE');
```
(You'll need to run this manually in the SQL Editor with your actual key.)

### Step 3: Update all 3 functions that read from vault
Update `notify_via_google_group` and `handle_priority_chat_notification` to read from `private.app_secrets` instead of `vault.decrypted_secrets`:

```sql
-- Replace this:
SELECT decrypted_secret INTO v_resend_key
FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;

-- With this:
SELECT value INTO v_resend_key
FROM private.app_secrets WHERE key = 'RESEND_API_KEY' LIMIT 1;
```

### Step 4: Clean up vault entry (optional)
Remove the vault entry since it's not usable:
```sql
DELETE FROM vault.secrets WHERE name = 'RESEND_API_KEY';
```

## After This
- All trigger functions will successfully read the API key from the private config table
- Announcements, recordings, notes, and schedule changes will send emails via Google Group relay
- Priority chat messages will send direct emails
- The key is secured by schema-level access control (only `postgres` role can read `private.app_secrets`)
