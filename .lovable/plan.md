

# Default to Latest Batch & Persist Batch Selection

## Problem
1. When the student opens the dashboard, the default batch is the first one alphabetically (`availableBatches[0]` after `.sort()`), not the most recently enrolled batch.
2. When the user switches batches, the selection is lost on tab change, sidebar navigation, or logout — it reverts to the alphabetical default.

## Solution

### 1. Fetch enrollments ordered by `created_at DESC`
Update the `user_enrollments` query in `StudentMain.tsx` to include `created_at` and order by `created_at` descending. This ensures the first unique batch extracted is the most recently enrolled one.

### 2. Derive batches preserving insertion order (latest first)
Change `availableBatches` from `.sort()` to preserve the order from the query (latest `created_at` first). Use a `Set` to deduplicate while keeping first-occurrence order.

### 3. Persist selected batch in `localStorage`
- When user switches batch (or on initial selection), save it to `localStorage` with key `student-selected-batch`.
- On initialization, check `localStorage` first (before URL params), then fall back to the latest batch from the query.
- This persists across tab changes, sidebar navigation, and even logout/login (same browser).

## File Changes

**`src/components/student/StudentMain.tsx`**

1. **Update `UserEnrollment` interface** — add `created_at: string`.

2. **Update query** — add `.select('batch_name, subject_name, created_at')` and `.order('created_at', { ascending: false })`.

3. **Update `availableBatches`** — remove `.sort()`, keep insertion order (latest first since query is ordered by `created_at DESC`).

4. **Update initialization logic** — priority order for default batch:
   - URL `?batch=` param (if valid)
   - `localStorage` saved batch (if valid/still enrolled)
   - First batch from `availableBatches` (latest enrolled)

5. **Update `handleSelectBatch`** — save to `localStorage` on switch.

6. **Update initial batch selection** — also save to `localStorage` when auto-selecting.

