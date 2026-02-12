

# Fix: Merged Class Isolation and Duplicate Recordings

## Problems Found (from real database data)

### Problem 1: Duplicate Recordings
On Feb 12, "Statistics 1" (which is merged between "Foundation Quiz 1" and "Qualifier January 2026") has TWO separate recordings with different YouTube broadcast IDs:
- 13:10 - Foundation Quiz 1 batch (embed: 04c3OxEnBD4)
- 13:34 - Qualifier January 2026 batch (embed: kXO5t3XY4tY)

**Root cause**: The teacher's schedule deduplication only merges cards when both schedules have IDENTICAL `start_time` AND `end_time`. If the times differ at all, two separate cards appear and the teacher starts two separate YouTube broadcasts. Additionally, `useYoutubeStream.startStream()` always inserts recordings using whatever batch/subject is passed to it, rather than using the primary pair.

### Problem 2: Students Landing in Isolated Meetings
**Root cause**: When `activeMerges` data hasn't loaded yet (cache miss, slow network), `getPrimaryPair()` returns the student's own batch/subject instead of the canonical primary pair. This generates a different Jitsi room name, isolating them from the actual class.

---

## Solution

### 1. Use primary pair for recording insertion (`useYoutubeStream.ts`)

Change `startStream` to accept an optional `primaryBatch` and `primarySubject` parameter. When provided (for merged classes), use those for the recording insert instead of the raw batch/subject. This ensures only ONE recording is created under the canonical primary pair.

```typescript
const startStream = async (batch: string, subject: string, primaryBatch?: string, primarySubject?: string) => {
  // ... create YouTube broadcast ...
  
  // Use primary pair for recording
  const recBatch = primaryBatch || batch;
  const recSubject = primarySubject || subject;
  
  await supabase.from('recordings').insert({
    batch: recBatch,
    subject: recSubject,
    topic: `${recSubject} Class - ${format(new Date(), 'MMM dd, yyyy')}`,
    date: new Date().toISOString(),
    embed_link: streamData.embedLink
  });
};
```

### 2. Fix teacher dedup to match by subject merge, not just time (`TeacherJoinClass.tsx`)

Currently the dedup requires `s.start_time === cls.start_time && s.end_time === cls.end_time` for merged cards. Remove this strict time check -- if two schedules are in a merge group and on the same day, they should ALWAYS be deduped into one card regardless of time differences.

```typescript
// BEFORE: requires identical times
const partner = filtered.find(s =>
  !consumed.has(s.id) && s.id !== cls.id &&
  s.batch === partnerBatch && s.subject === partnerSubject &&
  s.start_time === cls.start_time && s.end_time === cls.end_time  // <-- too strict
);

// AFTER: merge partners always dedup (same day is enough)
const partner = filtered.find(s =>
  !consumed.has(s.id) && s.id !== cls.id &&
  s.batch === partnerBatch && s.subject === partnerSubject
);
```

### 3. Pass primary pair when starting stream (`TeacherJoinClass.tsx`)

In `handleStartClass`, compute the primary pair and pass it to `startStream` so the recording is saved under the canonical batch/subject:

```typescript
const primary = getPrimaryPair(cls.batch, cls.subject);
const details = await startStream(cls.batch, cls.subject, primary.batch, primary.subject);
```

### 4. Guard against stale merge data in student join flows

In `StudentLiveClass.tsx`, `StudentJoinClass.tsx`, and `ClassSession.tsx`, add a safety check: if `activeMerges` is still loading, show a loading state instead of proceeding with a potentially wrong room name. Also in `ClassSession.tsx`, instead of using the raw `room_url` from `active_classes`, recompute the room URL using the primary pair for consistency:

```typescript
// ClassSession.tsx - AFTER finding activeClass
const allPairs = [{ batch: enrollment.batch_name, subject: enrollment.subject_name }];
if (merges?.length) {
  allPairs.push(
    { batch: merges[0].primary_batch, subject: merges[0].primary_subject },
    { batch: merges[0].secondary_batch, subject: merges[0].secondary_subject }
  );
}
const sorted = allPairs.sort((a, b) => `${a.batch}|${a.subject}`.localeCompare(`${b.batch}|${b.subject}`));
const primary = sorted[0];
const roomName = generateJitsiRoomName(primary.batch, primary.subject);
const finalUrl = `https://meet.jit.si/${roomName}#userInfo.displayName=...`;
```

### 5. Deduplicate recordings in the query (`StudentRecordings.tsx`)

As a safety net, deduplicate recordings by `embed_link` so even if duplicate entries exist in the DB, students only see each unique video once:

```typescript
// After fetching, deduplicate by embed_link
const uniqueByLink = new Map();
(data || []).forEach(rec => {
  if (!uniqueByLink.has(rec.embed_link)) {
    uniqueByLink.set(rec.embed_link, rec);
  }
});
return Array.from(uniqueByLink.values());
```

---

## Files to Modify

| File | Change |
|---|---|
| `src/hooks/useYoutubeStream.ts` | Accept optional primaryBatch/primarySubject params for recording insert |
| `src/components/teacher/TeacherJoinClass.tsx` | Remove strict time-match in dedup; pass primary pair to startStream |
| `src/components/student/StudentRecordings.tsx` | Deduplicate recordings by embed_link |
| `src/pages/ClassSession.tsx` | Recompute room URL from primary pair instead of using raw room_url |
| `src/components/student/StudentJoinClass.tsx` | Guard against loading merges state |
| `src/components/student/StudentLiveClass.tsx` | Guard against loading merges state |

## Summary

After this fix:
- Teacher always sees ONE card per merged class (regardless of schedule time mismatches)
- Only ONE YouTube broadcast and ONE recording is created per merged class
- Recording is stored under the canonical primary pair
- Students always compute the same Jitsi room name, even if merge data loads slowly
- Duplicate recordings are filtered out as a safety net in the student view
