

# Fix: Stop Recording Button Error

## Problem
When clicking "STOP REC", the `stop-youtube-stream` edge function fails with a 400 error. The YouTube API returns **403 "Invalid transition"** because the broadcast isn't in the right state (it may not be fully "live" yet, or may have already ended).

## Root Cause
The YouTube `liveBroadcasts/transition` API only allows transitioning to "complete" when the broadcast is in the **"live"** state. If the broadcast is still in "testing", "ready", or already "complete", YouTube rejects it.

## Solution

### 1. Update `stop-youtube-stream` edge function

Before attempting the transition, **check the broadcast's current status** using the YouTube API. Then handle each case:

- **Status is "live"**: Proceed with the transition to "complete" (current behavior).
- **Status is "complete"**: Already stopped -- return success immediately.
- **Status is "testing" or "ready"**: The stream never went fully live. Delete the broadcast instead (cleanup) and return success.
- **Any other error**: Return a descriptive error but still allow the frontend to clear the stream state.

Also update the CORS headers to include the full set of Supabase client headers.

### 2. Update frontend error handling in `TeacherJoinClass.tsx`

Even if the edge function fails (e.g., YouTube is unreachable), still clear the `stream_key` from the schedule so the button doesn't get stuck. Move the `stream_key` cleanup to a `finally` block or execute it regardless of the YouTube API result.

## Files to modify

| File | Change |
|---|---|
| `supabase/functions/stop-youtube-stream/index.ts` | Check broadcast status before transitioning; handle "complete", "testing", "ready" states gracefully; update CORS headers |
| `src/components/teacher/TeacherJoinClass.tsx` | Always clear `stream_key` after attempting stop, even on error |

## Technical Details

**Edge function changes** (`stop-youtube-stream/index.ts`):
- After getting the access token, call `GET liveBroadcasts/list?id={broadcastId}&part=status` to check current status
- If `lifeCycleStatus === 'live'`: do the transition to "complete"
- If `lifeCycleStatus === 'complete'`: skip transition, return success
- If `lifeCycleStatus` is "created", "ready", or "testing": delete the broadcast via `DELETE liveBroadcasts?id={broadcastId}` and return success
- Always return 200 with a descriptive message so the frontend can proceed

**Frontend changes** (`TeacherJoinClass.tsx`):
- Move the `stream_key` cleanup (`supabase.from('schedules').update({ stream_key: null })`) to always execute after the edge function call, regardless of success or failure
- This prevents the "STOP REC" button from getting stuck

