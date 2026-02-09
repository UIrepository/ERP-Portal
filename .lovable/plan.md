

# Fix Subject Merge Dropdowns to Show Real Batch-Subject Pairs

## Problem
The current "Create New Merge" form uses the `get_all_options` RPC which returns batches and subjects as two separate flat lists. This means:
- All subjects show for every batch, even if that subject doesn't exist in that batch
- There's no relationship between batch and subject in the dropdown

## Solution
Query `user_enrollments` for distinct `(batch_name, subject_name)` pairs. When the admin selects a batch, filter the subject dropdown to only show subjects that actually exist under that batch.

## Changes

**File: `src/components/admin/AdminSubjectMerges.tsx`**

1. Replace the `get_all_options` RPC query with a direct query on `user_enrollments` for distinct `batch_name, subject_name` pairs.
2. Derive unique batches from the enrollment data.
3. Filter subjects dynamically: when `primaryBatch` is selected, only show subjects that exist in that batch. Same for `secondaryBatch`.
4. Reset the subject selection when the batch changes (so stale selections don't persist).

---

## Technical Details

The query changes from:
```typescript
const { data } = await supabase.rpc('get_all_options');
```
to:
```typescript
const { data } = await supabase
  .from('user_enrollments')
  .select('batch_name, subject_name')
  .order('batch_name');
```

Then derive batches and filtered subjects:
```typescript
const batches = [...new Set(enrollments.map(e => e.batch_name))].sort();
const primarySubjects = enrollments
  .filter(e => e.batch_name === primaryBatch)
  .map(e => e.subject_name)
  .sort();
```

When batch selection changes, reset the corresponding subject to empty string to prevent invalid combinations.
