
# Fix: Duplicate Live Streams and Blank Lectures for Merged Classes

## Root Causes Identified

There are **3 bugs** working together to cause this:

### Bug 1: No loading guard for merge data (teacher side)
The `activeMerges` query has no loading state check. If the teacher loads the page before merge data arrives, `activeMerges` is an empty array. The dedup logic finds no merges, so **two separate class cards appear**. The teacher clicks "Start Class" on both, creating two YouTube broadcasts and two recordings.

### Bug 2: Stream key saved to only ONE schedule
When a merged class starts (line 329), `stream_key` and `broadcast_id` are only written to `cls.id` (the first schedule in the deduped pair). The partner schedule never gets it. If the partner happens to be enumerated first on a data refetch, the card appears without a stream key, and the teacher could accidentally start a second stream.

### Bug 3: Stop recording only clears ONE schedule
`handleStopRecording` (line 373) only clears `stream_key` from `cls.id`. The partner's stream_key (if it had one from Bug 2) would remain, causing ghost state.

## Changes

### File: `src/components/teacher/TeacherJoinClass.tsx`

**Change 1 -- Add merge loading guard**
- Destructure `isLoading` from the `activeMerges` query (rename to `isLoadingMerges`)
- Include it in the loading check on line 401: `const isLoading = isLoadingTeacher || isLoadingSchedules || isLoadingMerges;`
- This prevents the page from rendering before merge data is available, eliminating the race condition that shows two cards

**Change 2 -- Save stream key to ALL merged schedule IDs**
In `handleStartClass` (lines 325-332), after getting the stream details, write `stream_key` and `broadcast_id` to every schedule ID in the merged group, not just `cls.id`:

```
const allIds = cls.mergedBatches
  ? cls.mergedBatches.map(m => m.id)
  : [cls.id];

await supabase
  .from('schedules')
  .update({ stream_key: details.streamKey, broadcast_id: details.broadcastId })
  .in('id', allIds);
```

**Change 3 -- Clear stream key from ALL merged schedule IDs on stop**
In `handleStopRecording` (line 373), clear from all IDs:

```
const allIds = cls.mergedBatches
  ? cls.mergedBatches.map(m => m.id)
  : [cls.id];

await supabase
  .from('schedules')
  .update({ stream_key: null, broadcast_id: null })
  .in('id', allIds);
```

**Change 4 -- Check ALL merged schedules for existing stream key before starting**
Currently line 316 only checks `cls.stream_key`. For merged cards, also check if the partner already has a stream running:

```
const existingKey = cls.stream_key
  || cls.mergedBatches?.find(m => /* lookup from schedules */)?.stream_key;
```

Since the deduped card spreads `cls` (the first schedule), we need to also check the partner. The simplest approach: when building the deduped card, propagate any non-null `stream_key` from the partner to the merged card.

In the dedup logic (around line 225-236), when creating the merged card, if the partner has a `stream_key` but `cls` doesn't, use the partner's:

```
deduped.push({
  ...cls,
  stream_key: cls.stream_key || partner.stream_key,
  broadcast_id: cls.broadcast_id || partner.broadcast_id,
  mergedBatches: [...]
});
```

## Summary

These 4 changes ensure:
- Teacher never sees two cards for merged subjects (loading guard)
- Stream key is written to and cleared from ALL schedules in a merge group
- An existing stream on either schedule prevents a second stream from starting
- Only ONE YouTube broadcast and ONE recording is ever created per merged class
