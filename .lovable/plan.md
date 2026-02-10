

# Remove Hardcoded Resend API Key and Standardize Sender Email

## Problem
Four database trigger functions currently have the Resend API key **hardcoded** directly in the SQL code, which is a security risk. They also use inconsistent sender emails.

## Affected Functions (all have hardcoded `re_NohT67im_...`)
1. `notify_via_google_group()` -- sender: `notifications@hq.unknowniitians.com` (correct)
2. `handle_email_notification()` -- sender: `support@unknowniitians.live` (wrong)
3. `handle_general_notifications()` -- sender: `support@unknowniitians.live` (wrong)
4. `handle_priority_chat_notification()` -- sender: `support@unknowniitians.live` (wrong)

## What Will Change

### For all 4 functions:
- **Remove hardcoded API key** -- replace with a vault lookup: `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1`
- **Standardize sender** to `Unknown IITians <notifications@hq.unknowniitians.com>`

### Prerequisite
- Store the Resend API key in Supabase Vault (not just edge function secrets) by running:
  ```sql
  SELECT vault.create_secret('re_YOUR_KEY_HERE', 'RESEND_API_KEY');
  ```
  This makes it accessible from database functions.

## Technical Steps

1. **Insert the Resend API key into Supabase Vault** via a SQL migration so database functions can access it
2. **Migrate all 4 functions** with updated SQL that:
   - Reads the key from `vault.decrypted_secrets` at runtime
   - Uses `notifications@hq.unknowniitians.com` as the sender
   - Raises a warning (but does not crash) if the key is missing

## After This
Proceed with the Google Groups full sync automation plan (creating `sync-google-groups` edge function and backfilling all existing enrollments).

