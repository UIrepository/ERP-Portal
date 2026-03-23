

# Fix: All Edge Function Calls from Database Return 401

## Root Cause

Two issues causing 401 errors on all `pg_net` HTTP calls from the database:

### Issue 1: Cron jobs use placeholder auth key
The `check-class-reminders` and `check-recording-emails` cron jobs (running every 1 and 5 minutes respectively) have `"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"` -- a literal placeholder string that was never replaced with the actual key. This causes 401 on every run.

### Issue 2: Edge functions require JWT but triggers can't provide user JWTs
`manage-google-group`, `sync-google-groups`, `send-class-reminders`, `send-recording-emails`, and `send-community-email` all have `verify_jwt = true` in `config.toml`. Database triggers and cron jobs cannot produce user-level JWTs. The anon key sent by triggers is being rejected with "Invalid Token or Protected Header formatting".

## Fix Plan

### Step 1: Update `supabase/config.toml`
Set `verify_jwt = false` for all edge functions called from database triggers or cron jobs. These functions are backend-only and called from the database -- they should NOT require JWT verification at the gateway level. Instead, they should validate requests internally if needed.

Functions to change to `verify_jwt = false`:
- `manage-google-group` (called by `auto_add_to_google_group` trigger)
- `sync-google-groups` (called manually/admin)
- `send-class-reminders` (called by cron every minute)
- `send-recording-emails` (called by cron every 5 minutes)
- `send-community-email` (called from app)

### Step 2: Fix cron jobs to use the service role key
Update the two cron jobs to use the actual service role key instead of the `"YOUR_SERVICE_ROLE_KEY"` placeholder. This requires a database migration to alter the cron jobs.

We'll use the service role key stored in the Supabase environment. The cron SQL will read it from `current_setting('supabase.service_role_key')` or we'll need to pass it directly.

### Step 3: Clean up stale 401 responses
Clear the `net._http_response` table of old failed responses to prevent confusion.

## Impact
- Google Group creation on new enrollment will start working
- Class reminder emails will start sending
- Recording notification emails will start sending
- Content emails (DPP, UI Ki Padhai) already work via direct Resend API calls from triggers -- unaffected
- Announcement/notes/schedule emails also work via direct Resend API -- unaffected

