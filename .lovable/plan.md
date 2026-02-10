

# Fix: Merged Subject Students Landing in Wrong Jitsi Room

## Root Cause

There are **two bugs** causing students in merged batches (e.g., "Qualifier" + "Foundation Quiz 1") to end up in different Jitsi rooms:

### Bug 1: StudentLiveClass batch-level mode skips primary pair resolution (MAIN ISSUE)

In `StudentLiveClass.tsx` lines 108-110, when in batch-level mode, the code uses the schedule's own `batch` and `subject` directly instead of resolving the primary pair:

```
// Current (BROKEN):
const roomBatch = isBatchLevel ? schedule.batch : (primaryPair?.batch || batch || '');
const roomSubject = isBatchLevel ? schedule.subject : (primaryPair?.subject || subject || '');
```

This means:
- A "Qualifier" student generates room: `classqualifier{subject}{date}`
- A "Foundation Quiz 1" student generates room: `classfoundationquiz1{subject}{date}`
- They land in **different rooms** even though their subjects are merged.

The batch-level mode needs to fetch active merges and resolve primary pairs per-schedule, just like `StudentJoinClass` does.

### Bug 2: ClassSession page ignores merges entirely

`ClassSession.tsx` (the secure redirect page) looks up `active_classes` using the student's own `batch_name` and `subject_name`. If the teacher started the class under the primary pair's batch (e.g., "Foundation Quiz 1"), a student enrolled in "Qualifier" won't find a matching `active_classes` row, causing "Class is not live yet" errors.

Additionally, when redirecting, it uses the `room_url` from the database, but if that somehow fails it has no fallback primary pair resolution.

### Bug 3: Build errors in sync-google-groups (pre-existing)

Four TypeScript errors where `err` is typed as `unknown` but `.message` is accessed directly. These are unrelated but block builds.

## Fix Plan

### Step 1: Fix StudentLiveClass -- resolve primary pair in batch-level mode

**File:** `src/components/student/StudentLiveClass.tsx`

- Fetch `subject_merges` (active) just like `StudentJoinClass` does
- Create a `getPrimaryPair` helper (same pattern as in `StudentJoinClass`)
- Replace lines 108-110: always use `getPrimaryPair(schedule.batch, schedule.subject)` for room name generation, regardless of batch-level or subject-level mode

### Step 2: Fix ClassSession -- check merged pairs for active_classes lookup

**File:** `src/pages/ClassSession.tsx`

- After fetching the enrollment, query `subject_merges` to find all pairs in the merge group
- Check `active_classes` for ANY pair in the merge group (not just the student's own batch+subject)
- Use the `room_url` from whichever active class is found

### Step 3: Fix build errors in sync-google-groups

**File:** `supabase/functions/sync-google-groups/index.ts`

- Cast `err` to `(err as Error).message` at lines 194, 202, 249, 257

## Technical Details

### StudentLiveClass.tsx changes

```ts
// Add query for active merges (same as StudentJoinClass)
const { data: activeMerges = [] } = useQuery({
  queryKey: ['active-merges-for-student-live'],
  queryFn: async () => {
    const { data } = await supabase
      .from('subject_merges').select('*').eq('is_active', true);
    return data || [];
  },
  staleTime: 5 * 60 * 1000,
});

// Add getPrimaryPair helper
const getPrimaryPair = (batch, subject) => {
  const merge = activeMerges.find(m =>
    (m.primary_batch === batch && m.primary_subject === subject) ||
    (m.secondary_batch === batch && m.secondary_subject === subject)
  );
  if (!merge) return { batch, subject };
  const pairs = [
    { batch: merge.primary_batch, subject: merge.primary_subject },
    { batch: merge.secondary_batch, subject: merge.secondary_subject }
  ];
  return pairs.sort((a, b) =>
    `${a.batch}|${a.subject}`.localeCompare(`${b.batch}|${b.subject}`)
  )[0];
};

// Replace lines 108-110 with:
const primary = getPrimaryPair(schedule.batch, schedule.subject);
const roomBatch = primary.batch;
const roomSubject = primary.subject;
```

### ClassSession.tsx changes

After fetching enrollment, also fetch merge info:

```ts
// Check if this batch+subject is part of a merge
const { data: merges } = await supabase
  .from('subject_merges')
  .select('*')
  .eq('is_active', true)
  .or(`and(primary_batch.eq."${enrollment.batch_name}",primary_subject.eq."${enrollment.subject_name}"),and(secondary_batch.eq."${enrollment.batch_name}",secondary_subject.eq."${enrollment.subject_name}")`);

// Build list of all batch+subject pairs to check
const pairsToCheck = [
  { batch: enrollment.batch_name, subject: enrollment.subject_name }
];
if (merges?.length) {
  const m = merges[0];
  pairsToCheck.push(
    { batch: m.primary_batch, subject: m.primary_subject },
    { batch: m.secondary_batch, subject: m.secondary_subject }
  );
}

// Check active_classes for ANY pair in the merge group
let activeClass = null;
for (const pair of pairsToCheck) {
  const { data } = await supabase.from('active_classes')
    .select('room_url').eq('batch', pair.batch)
    .eq('subject', pair.subject).eq('is_active', true).maybeSingle();
  if (data) { activeClass = data; break; }
}
```

### sync-google-groups fix

Replace `err.message` with `(err as Error).message` at lines 194, 202, 249, 257.

## Summary

| File | Change | Impact |
|---|---|---|
| `StudentLiveClass.tsx` | Resolve primary pair for ALL schedules (not just subject-level) | Students in merged batches always get the same Jitsi room |
| `ClassSession.tsx` | Check all merged pairs when looking up active_classes | Secure redirect works for merged batch students |
| `sync-google-groups/index.ts` | Fix `err` type casting | Unblocks builds |

