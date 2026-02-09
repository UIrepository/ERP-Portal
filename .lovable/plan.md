

# Fix: Show Live Classes in Batch-Level "Join Live Class" Tab

## Problem
When a student clicks the "Join Live Class" tab in the main dashboard header (batch-level view), the component receives only `batch` but no `subject`. The current code relies on `useMergedSubjects(batch, undefined)`, which is disabled when subject is missing, causing the schedule query to return empty results. Meanwhile, the same component works fine inside a subject's block view because both `batch` and `subject` are passed.

## Solution
Update `StudentLiveClass.tsx` to handle two modes:

1. **Batch-level mode** (no subject): Fetch all schedules for the batch across all subjects, query active classes and meeting links for the entire batch, and generate proper Jitsi room names per subject (using merge logic where applicable).
2. **Subject-level mode** (subject provided): Keep the current merge-aware logic unchanged.

## Technical Details

**File: `src/components/student/StudentLiveClass.tsx`**

- In the `queryFn`, add a branch for when `subject` is falsy:
  - Fetch all schedules for the batch (no subject filter) using `.eq('batch', batch)` only
  - Fetch all active classes and meeting links for the batch (no subject filter)
  - For each schedule found, determine its Jitsi room name by calling a lightweight merge check per subject, or simply use the schedule's own batch+subject (since the batch-level view is just an overview)
- When `subject` is provided, keep the existing merge-aware logic exactly as-is
- The deduplication and live/upcoming classification logic stays the same for both modes
- No changes to any other files

This is a contained change to a single branching condition inside the existing query function.

