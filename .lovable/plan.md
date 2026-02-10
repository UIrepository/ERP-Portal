

# Fix: Stop Recording Not Actually Stopping YouTube Stream

## Root Cause

The stop function extracts the broadcast ID from the `recordings` table by looking up the most recent recording for the batch/subject. But:

1. **Multiple recordings** exist for the same batch/subject on the same day (e.g., Statistics 1 has multiple entries). The query may pick the wrong one.
2. **The broadcast ID (`videoId`) is never persisted to the database.** It's only stored in `broadcastIdRef` (React ref), which is lost on page refresh.
3. **9+ schedules currently have stale `stream_key` values** that were never cleared, indicating the stop flow has been broken for a while.

## Solution

### 1. Add `broadcast_id` column to `schedules` table

Store the YouTube broadcast ID directly alongside the `stream_key` when a stream is created. This way, the stop function always has the correct ID regardless of what's in the recordings table.

**Database migration:**
```sql
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS broadcast_id text;
```

### 2. Update `handleStartClass` in `TeacherJoinClass.tsx`

When saving the `stream_key` to the schedule, also save the `broadcast_id`:

```typescript
await supabase
  .from('schedules')
  .update({ stream_key: details.streamKey, broadcast_id: details.broadcastId })
  .eq('id', cls.id);
```

### 3. Update `handleStopRecording` in `TeacherJoinClass.tsx`

Instead of looking up recordings to find the broadcast ID, read it directly from the schedule's `broadcast_id` column:

```typescript
const handleStopRecording = async (cls: Schedule) => {
  const broadcastId = cls.broadcast_id; // Direct from schedule
  if (!broadcastId) {
    toast.error("No broadcast ID found.");
    // Still clear stream_key
    await supabase.from('schedules').update({ stream_key: null, broadcast_id: null }).eq('id', cls.id);
    return;
  }
  // Call edge function with broadcastId...
  // In finally: clear both stream_key AND broadcast_id
};
```

### 4. Update Schedule type and query

- Add `broadcast_id` to the `Schedule` interface
- Add `broadcast_id` to the schedules query select
- Clear `broadcast_id` alongside `stream_key` in the finally block

### 5. Clean up stale stream keys

Run a one-time SQL to clear the 9+ stale stream keys currently stuck in the schedules table:

```sql
UPDATE schedules SET stream_key = NULL WHERE stream_key IS NOT NULL;
```

## Files to modify

| File | Change |
|---|---|
| Database migration | Add `broadcast_id` column to `schedules` |
| `src/components/teacher/TeacherJoinClass.tsx` | Save `broadcast_id` on start, read it on stop, clear both on stop |

## Summary of flow after fix

1. **Start**: Create YouTube broadcast, save both `stream_key` and `broadcast_id` to the schedule row
2. **Stop**: Read `broadcast_id` directly from the schedule, call edge function with it, clear both fields
3. No more dependency on the recordings table for finding the broadcast ID
4. No more in-memory-only refs that break on page refresh

