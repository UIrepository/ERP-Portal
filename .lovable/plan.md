

# Fix: Merged Batch Live Class Detection in Subject Block

## Problem
When a student opens the **Live Class** section inside a subject block, the `activeJitsi` lookup (line 139) matches on exact `batch + subject`. If the teacher started the class under the **partner** batch/subject in a merge group, the lookup fails — `is_jitsi_live` is `false`, so the student sees "Waiting for Teacher..." instead of "Join Class", even though the class is live.

The room URL generation (line 144-148) already uses `getPrimaryPair` correctly, so the link itself would be correct — but the button is hidden because `is_jitsi_live` is wrong.

## Fix — `src/components/student/StudentLiveClass.tsx`

**Change 1: Add `useMergedSubjects` loading guard** (line 38)
Destructure `isLoading: isMergedPairsLoading` and include it in the loading check at line 244.

**Change 2: Make `activeJitsi` lookup merge-aware** (lines 139-140)
Replace the direct batch+subject match with primary-pair resolution:

```ts
const schedulePrimary = getPrimaryPair(schedule.batch, schedule.subject);
const activeJitsi = allActiveClasses?.find(ac => {
  const acPrimary = getPrimaryPair(ac.batch, ac.subject);
  return acPrimary.batch === schedulePrimary.batch && acPrimary.subject === schedulePrimary.subject;
});
```

**Change 3: Make `subjectLink` lookup merge-aware** (line 141)
Same approach:

```ts
const subjectLink = allMeetingLinks?.find(l => {
  const lPrimary = getPrimaryPair(l.batch, l.subject);
  return lPrimary.batch === schedulePrimary.batch && lPrimary.subject === schedulePrimary.subject;
});
```

This ensures that when a teacher starts a class under either side of a merge, both sides detect it as live and generate the same room URL.

