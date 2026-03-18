

# Fix: New batch/subject combos not appearing in Staff Manager

## Problem
`AdminStaffManager.tsx` (line 213) queries `user_enrollments` table with `.select('batch_name, subject_name')` and no explicit limit. Supabase defaults to 1000 rows. When enrollment count exceeds 1000, newer batch/subject combinations are missing from the dropdown options.

## Solution
Replace the raw `user_enrollments` query with a query that fetches only **distinct** batch and subject values. Two options:

**Option A (Recommended):** Query `user_enrollments` but select only distinct batch_name and subject_name combinations. Since `.select()` doesn't support `DISTINCT` directly, we can use an RPC function or simply set a much higher limit (e.g., 10000) and continue deduplicating client-side.

**Option B (Cleaner):** Create a small database function `get_distinct_enrollment_options()` that returns distinct batch/subject pairs, avoiding the row limit entirely.

I'll go with **Option A** (simplest, no migration needed): just add `.limit(10000)` to the query on line 215. This ensures all enrollments are fetched for deduplication.

## File Change

**`src/components/admin/AdminStaffManager.tsx`** (line 215):
- Add `.limit(10000)` to the `user_enrollments` query to bypass the 1000-row default.

```ts
const { data, error } = await supabase
  .from('user_enrollments')
  .select('batch_name, subject_name')
  .limit(10000);
```

This is a one-line fix that will surface all batch/subject combinations in the Staff Management dropdowns.

