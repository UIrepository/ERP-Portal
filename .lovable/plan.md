

# Revised Subject Merge System -- Scoped to Live Classes & Recordings Only

## What Changes

The merge system is being simplified. Instead of merging everything (communities, notes, DPP, schedule, etc.), merging will **only** affect:

1. **Live Classes** -- When two merged subjects have classes at the **same time**, students from both join the **same Jitsi room**. If timings differ, they are treated as separate classes.
2. **Recordings** -- When a recording is added to one merged subject, it appears in both.
3. **Teacher View** -- Teacher sees merged subject names (e.g., "Physics (Batch A + Batch B)") in their Join Class page when subjects are merged.

Everything else stays **completely independent** -- communities, notes, DPP, schedule, UI Ki Padhai all remain unmerged.

```text
MERGED:
  Live Class (same timing) --> same Jitsi room for both batches
  Recordings              --> shared across both batches

NOT MERGED (stays normal):
  Community chat           --> separate per batch/subject
  Notes                    --> separate per batch/subject
  DPP                      --> separate per batch/subject
  Schedule view            --> separate per batch/subject
  UI Ki Padhai             --> separate per batch/subject
```

---

## Technical Details

### 1. Remove merge logic from these components (revert to simple queries)

**Files to modify:**

- **`src/components/student/StudentCommunity.tsx`** -- Remove `useMergedSubjects` import and usage. Revert the message query to simple `.eq('batch', batch).eq('subject', subject)` instead of `.or(orFilter)`. Revert the realtime subscription to listen to only the selected group's batch (no multi-channel merge logic).

- **`src/components/student/StudentNotes.tsx`** -- Remove `useMergedSubjects` import and usage. Revert query to `.eq('batch', batch).eq('subject', subject)`.

- **`src/components/student/StudentUIKiPadhai.tsx`** -- Remove `useMergedSubjects` import and usage. Revert query to `.eq('batch', batch).eq('subject', subject)`.

- **`src/components/student/StudentSchedule.tsx`** -- Remove the `activeMerges` query and `expandedPairs` logic. Revert to querying schedules based only on the student's own enrollments.

- **`src/components/student/StudentDPP.tsx`** -- Remove the `activeMerges` query and `expandedEnrollments` logic. Revert to querying DPP content based only on the student's own enrollments.

### 2. Keep merge logic in these components (with improvements)

**`src/components/student/StudentRecordings.tsx`** -- Keep using `useMergedSubjects` and `orFilter` so recordings from a merged subject appear in both.

**`src/components/student/StudentLiveClass.tsx`** -- Keep using `useMergedSubjects`. The current logic already:
- Fetches schedules from all merged pairs
- Deduplicates by time slot
- Uses the `primaryPair` for consistent Jitsi room naming
This stays as-is.

**`src/components/student/StudentJoinClass.tsx`** -- Add merge-awareness here too. When building the Jitsi room URL in `handleJoinClass`, check if the class's batch+subject has a merge. If so, use the `primaryPair` to generate the room URL so the student lands in the same room as the merged batch.

### 3. Update Teacher Join Class to show merged labels

**`src/components/teacher/TeacherJoinClass.tsx`** -- Fetch active merges. For each class in the teacher's list, check if a merge exists for that batch+subject. If so, display both names, e.g., "Physics (Batch A + Batch B)" instead of just "Physics / Batch A". This is a display-only change -- the teacher already has the manual merge-session feature with checkboxes.

### 4. Summary of file changes

| File | Action |
|------|--------|
| `src/components/student/StudentCommunity.tsx` | **Remove** merge logic, revert to simple batch/subject queries |
| `src/components/student/StudentNotes.tsx` | **Remove** merge logic, revert to simple batch/subject queries |
| `src/components/student/StudentUIKiPadhai.tsx` | **Remove** merge logic, revert to simple batch/subject queries |
| `src/components/student/StudentSchedule.tsx` | **Remove** merge logic, revert to enrollment-only queries |
| `src/components/student/StudentDPP.tsx` | **Remove** merge logic, revert to enrollment-only queries |
| `src/components/student/StudentRecordings.tsx` | **Keep** merge logic (recordings shared) |
| `src/components/student/StudentLiveClass.tsx` | **Keep** merge logic (same room for same-time classes) |
| `src/components/student/StudentJoinClass.tsx` | **Add** merge-aware room URL generation |
| `src/components/teacher/TeacherJoinClass.tsx` | **Add** merged label display |
| `src/hooks/useMergedSubjects.ts` | **Keep** as-is (still needed by recordings + live class) |

No database changes needed -- the `subject_merges` table and `get_merged_pairs` function remain unchanged.

