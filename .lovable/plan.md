

# Email System Overhaul

## Overview
Complete restructure of the email notification system to stop BCC abuse, switch to plain text, add class reminders, fix recording email timing, and add community email notifications for teachers/admin.

## Changes

### 1. Database Migration

**A. Add `reminder_time` column to `schedules` table**
- New column: `reminder_time TIME` that defaults to `start_time - 15 minutes`
- Add a trigger to auto-calculate `reminder_time` whenever `start_time` changes (so admins don't need to manually set it)
- Add `reminder_sent_date DATE` to track which date's reminder was already sent (prevents duplicates)

**B. Create `allstudents@unknowniitians.com` Google Group entry**
- Insert a row into `google_groups` with `batch_name = '__ALL__'`, `subject_name = NULL`, `group_email = 'allstudents@unknowniitians.com'`

**C. Update `manage-google-group` edge function**
- When adding a student to batch + subject groups, also add them to `allstudents@unknowniitians.com`
- Update `sync-google-groups` to also backfill the all-students group

**D. Rewrite `notify_via_google_group()` trigger function**
- Convert ALL email content from HTML to plain text (no HTML tags, no emojis)
- Professional, clean plain-text emails like: subject line as clear description, body with relevant details only
- Remove the recording section from this trigger entirely (recordings will be handled by cron)
- Keep: announcements (to batch -all group or allstudents group), schedule changes, notes

**E. Rewrite `handle_priority_chat_notification()` trigger function**
- Remove ALL BCC logic
- Instead, send to the subject's Google Group (same as other notifications)
- Plain text format, no HTML, no emojis

**F. Create `send-class-reminders` edge function**
- Runs via pg_cron every minute
- Queries schedules where `reminder_time` matches current time (within a 1-minute window) and `reminder_sent_date != today`
- For each match: sends plain-text email to the subject Google Group AND to the teacher's email (looked up from `teachers` table by matching batch + subject)
- Marks `reminder_sent_date = today` to prevent re-sending

**G. Create `send-recording-emails` edge function**  
- Runs via pg_cron every 5 minutes
- Checks for recordings inserted today where the corresponding schedule's `end_time` has passed
- Uses a `recording_email_sent BOOLEAN DEFAULT false` column on `recordings` to prevent duplicates
- Sends plain-text email to the subject Google Group

**H. Announcement "All Batches + All Subjects" trigger**
- When announcement has `target_batch IS NULL` and `target_subject IS NULL`, send to `allstudents@unknowniitians.com` (single email) instead of looping through all batch groups

### 2. Frontend Changes

**A. Community "Send Email Notification" button (TeacherCommunity + AdminCommunity)**
- Add a `Mail` icon button in the message input area
- When clicked, show a confirmation AlertDialog:
  - Title: "Send Email Notification"
  - Description: "This action cannot be undone. An email will be sent to all students in [Subject] - [Batch]. Proceed only if this message is important."
  - Two buttons: "Cancel" and "Send Email"
- On confirmation: call an edge function `send-community-email` that sends the message content as plain text to the subject's Google Group
- The email is sent independently of the chat message (it's a separate action)

**B. Create `send-community-email` edge function**
- Accepts: `batch`, `subject`, `message_content`, `sender_name`
- Looks up the subject Google Group email from `google_groups` table
- Sends a professional plain-text email via Resend

### 3. Plain Text Email Format (all emails)

All emails will use this professional format -- no HTML, no emojis, no styling:

```
Subject: Unknown IITians - Class Reminder: Mathematics 1

Dear Student,

Your Mathematics 1 class is starting in 15 minutes.

Batch: Foundation Quiz 1
Time: 3:00 PM - 4:00 PM

Please join the class on time through your dashboard.

Regards,
Unknown IITians Academic Team
```

Resend supports plain text via the `text` field instead of `html` field, which avoids spam filters.

### 4. pg_cron Jobs

Two cron jobs:
- `check-class-reminders`: runs every minute, calls the `send-class-reminders` edge function
- `check-recording-emails`: runs every 5 minutes, calls the `send-recording-emails` edge function

## Technical Details

### Files to create:
- `supabase/functions/send-class-reminders/index.ts` -- cron-triggered, checks schedules and sends reminders
- `supabase/functions/send-recording-emails/index.ts` -- cron-triggered, checks recordings after class end
- `supabase/functions/send-community-email/index.ts` -- called from frontend for community email notifications

### Files to modify:
- `supabase/functions/manage-google-group/index.ts` -- add student to allstudents group
- `supabase/functions/sync-google-groups/index.ts` -- backfill allstudents group
- `src/components/teacher/TeacherCommunity.tsx` -- add "send email notification" button with confirmation
- `src/components/admin/AdminCommunity.tsx` -- add "send email notification" button with confirmation

### Database migration:
- Add `reminder_time TIME`, `reminder_sent_date DATE` to `schedules`
- Add `recording_email_sent BOOLEAN DEFAULT false` to `recordings`
- Auto-set trigger for `reminder_time = start_time - interval '15 minutes'`
- Rewrite `notify_via_google_group()` -- plain text, remove recordings section, use allstudents group for global announcements
- Rewrite `handle_priority_chat_notification()` -- switch from BCC to Google Group, plain text
- Drop `trg_google_group_recording` trigger (recordings handled by cron now)
- Insert allstudents group row into `google_groups`
- Create pg_cron jobs for reminders and recording emails

### Summary table

| Change | Purpose |
|---|---|
| Remove all BCC logic | Stop burning Resend daily limit |
| All emails to plain text | Avoid Gmail spam filters |
| No emojis in subject lines | Professional appearance |
| `reminder_time` column on schedules | Configurable reminder timing |
| Cron for class reminders | Send reminder + teacher email 15 min before class |
| Cron for recording emails | Only send after class `end_time` passes |
| `allstudents@unknowniitians.com` group | Single group for all-batch announcements |
| Community "Send Email" button | Teacher/admin can email students from community chat |
| Confirmation dialog | Prevents accidental email sends |

