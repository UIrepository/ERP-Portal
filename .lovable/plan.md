

# Simplify Recordings Fetch for Merged Subjects

## Context
The recordings table now has a separate row for each batch/subject in a merge group (with the same embed_link). The current code already uses `useMergedSubjects` + `orFilter` to fetch across merge pairs, and deduplicates by `embed_link`. It also has a `mergeFilteredRecordings` step that filters partner-batch recordings by merge date -- this is now unnecessary since each batch gets its own row.

## What needs to change

**File: `src/components/student/StudentRecordings.tsx`**

1. **Remove the `mergeFilteredRecordings` filter** (lines 100-112) -- since every merged batch now has its own recording row, the student's own batch/subject row will always exist. No need to filter partner recordings by merge date.

2. **Simplify the query**: Instead of using `orFilter` (which fetches all merge partners and then deduplicates), query only for the student's own `batch` + `subject`. Since each merged batch now gets its own row, the student will see all their recordings directly without needing the merge OR filter.

3. **Remove the deduplication by `embed_link`** -- no longer needed since we query only the student's own batch/subject.

4. **Update `filteredRecordings`** to filter directly from `recordings` instead of `mergeFilteredRecordings`.

5. **Remove `mergedPairs` destructuring** from `useMergedSubjects` since it's no longer used for filtering (keep `orFilter` only if other parts depend on it, but since we're simplifying the query, we can remove the hook usage entirely).

## Summary
This is a simplification: replace the complex merge-aware query + date filter + dedup with a straightforward query on `batch` + `subject` directly, since the recordings table now guarantees each batch has its own rows.

