

# Fix Duplicate Email Notifications

## Problem
When an announcement or recording is created, **two separate triggers** fire and send emails to the same students:
1. `handle_email_notification` -- sends directly to each student via BCC
2. `notify_via_google_group` -- sends to the Google Group, which relays to the same students

This means students get **2 copies** of every announcement and recording email.

## Recommended Fix

Since Google Groups is the preferred relay system (better for managing large lists, avoids Resend daily limits), **disable the direct-email triggers** and keep only the Google Group path.

### Step 1: Drop redundant triggers
Remove these triggers that cause duplicates:
- `on_announcement_created` on `notifications` (direct email) -- Google Group trigger handles it
- `on_recording_created` on `recordings` (direct email) -- Google Group trigger handles it
- `on_notes_created` on `notes` (direct email) -- needs a Google Group trigger added instead

### Step 2: Add Google Group trigger for `notes`
Currently `notes` only has the direct-email trigger. Add a `notify_via_google_group` trigger for `notes` so it uses the relay system too. The `notify_via_google_group` function already handles the `notes` table (it checks `TG_TABLE_NAME`).

### Step 3: Clean up orphaned function
Drop `handle_general_notifications` -- it has no trigger and overlaps with the other two functions.

### Step 4: Optionally drop `handle_email_notification`
Once all tables use the Google Group relay, this function becomes unused and can be removed.

## After This
- Announcements: 1 email via Google Group relay
- Recordings: 1 email via Google Group relay
- Notes: 1 email via Google Group relay (new)
- Schedule changes: 1 email via Google Group relay (already correct)
- Priority chat messages: 1 email direct (no Google Group equivalent needed -- this targets students by batch/subject directly)

## What stays unchanged
- `handle_priority_chat_notification` on `community_messages` -- this is the only trigger for priority messages, no duplication
- `set_notification_creator_name` on `notifications` -- this just sets metadata, not an email trigger
- All sender emails remain `notifications@hq.unknowniitians.com`

