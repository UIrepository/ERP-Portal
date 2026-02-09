

# Deduplicate Merged Classes in Teacher Join Class View

## Problem
When two subjects are merged (e.g., "ONLY FOR TEST / TESTING BATCH" and "ONLY FOR TESt / Testing batch 2"), the teacher sees **both** as separate cards in the Join Class page. Since they share the same timing, they should appear as a **single combined card**.

## Solution
After filtering today's classes, deduplicate them: if two classes belong to the same merge group AND have the same time slot, combine them into one card showing both batch names.

## Technical Details

**File: `src/components/teacher/TeacherJoinClass.tsx`**

1. **Add deduplication logic** in the `todaysClasses` useMemo (around line 180-203). After filtering, group classes that:
   - Are in the same merge group (checked via `activeMerges`)
   - Have the same `start_time` and `end_time`

2. **Keep only one schedule per merged group** but attach metadata about all the batches involved, so the card can display "ONLY FOR TEST (TESTING BATCH + Testing batch 2)".

3. **Update the card rendering** (around line 460-476) to show the combined batch names from the deduplication metadata instead of just `cls.batch`.

4. **When starting a merged class from a single card**, automatically handle all underlying schedules (mark attendance, create active_classes entries for both batch/subject pairs) using the same logic already in `handleStartClass` but extended to cover both sides of the merge.

Concrete changes:
- Create a new type or extend Schedule with an optional `mergedBatches: string[]` field
- In `todaysClasses` memo, after filtering, run a dedup pass: for each class, check if another class in the list is its merge partner with identical timing. If so, merge them into one entry with both batch names stored
- Update the card UI to show combined batches
- Update `handleStartClass` to also upsert `active_classes` for the merge partner when a merge exists

