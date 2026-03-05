

# Fix: Recordings Lost After Demerge

## Problem

Currently, when a merged class records, only ONE row is inserted into `recordings` under the "primary pair". After demerge, `get_merged_pairs` no longer returns the other batches, so students in non-primary batches lose access to all recordings made during the merge period.

## Solution

When a recording is created for a merged class, insert a row for **every** batch/subject combination in the merge group. Each row shares the same `embed_link` but has its own `batch`/`subject`. This way:

- After demerge, each batch retains its own recording rows
- No data loss regardless of merge/demerge lifecycle
- Lecture numbering stays dynamic per-batch (based on that batch's recording count)
- The existing `embed_link` dedup in `StudentRecordings` prevents duplicates while merged

## Changes

### File: `src/hooks/useYoutubeStream.ts`

Update `startStream` to accept an optional array of all merged pairs (not just the primary). Insert one recording row per pair instead of a single row:

```typescript
const startStream = async (
  batch: string, 
  subject: string, 
  primaryBatch?: string, 
  primarySubject?: string,
  allMergedPairs?: Array<{ batch: string; subject: string }>
) => {
  // ... existing stream creation logic ...

  // Instead of single insert, insert for all pairs
  const pairs = allMergedPairs && allMergedPairs.length > 0
    ? allMergedPairs
    : [{ batch: primaryBatch || batch, subject: primarySubject || subject }];

  const recordingRows = pairs.map(p => ({
    batch: p.batch,
    subject: p.subject,
    topic: `${p.subject} Class - ${format(new Date(), 'MMM dd, yyyy')}`,
    date: new Date().toISOString(),
    embed_link: streamData.embedLink,
  }));

  const { error: dbError } = await supabase.from('recordings').insert(recordingRows);
  // ... rest unchanged ...
};
```

### File: `src/components/teacher/TeacherJoinClass.tsx`

Pass the full list of merged batch/subject pairs when calling `startStream`. The `mergedBatches` array on the deduped schedule card already contains all pairs:

```typescript
const mergedPairs = cls.mergedBatches
  ? cls.mergedBatches.map(m => ({ batch: m.batch, subject: m.subject }))
  : [{ batch: cls.batch, subject: cls.subject }];

const details = await startStream(cls.batch, cls.subject, primary.batch, primary.subject, mergedPairs);
```

### File: `src/components/student/StudentRecordings.tsx`

The existing `embed_link` dedup (lines 88-95) already handles this -- while merged, students see recordings from all pairs but dedup by link shows only one card. After demerge, the OR filter only returns their own batch's rows, which now exist.

No changes needed here.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useYoutubeStream.ts` | Accept `allMergedPairs` param, insert one row per pair |
| `src/components/teacher/TeacherJoinClass.tsx` | Pass merged pairs array to `startStream` |

