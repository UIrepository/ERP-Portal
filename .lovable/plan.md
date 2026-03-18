

# Fix: Staff Manager Not Showing New Batch/Subject Combinations

## Problem Analysis
The `.limit(10000)` fix was applied but the issue persists. After investigating:

- The `user_enrollments` table has 1211 rows with 51 unique batch/subject combinations
- All new combos (e.g., "Foundation Quiz 2 - Data Science", "Python OPPE 1 Batch") exist in the database
- The query code looks correct with `.limit(10000)`

The likely root cause is a **client-side issue**: either React Query is serving stale cached data, or the Supabase client-side query is still being limited by the PostgREST default. A more robust fix is to **move the distinct computation to the database** using an RPC function, eliminating the row-limit concern entirely.

## Plan

### 1. Create a database function to return distinct batch/subject pairs
Create a new Supabase RPC function `get_distinct_enrollment_options()` that returns only the unique `batch_name` and `subject_name` pairs directly from the database. This avoids any row-limit issues entirely and is more performant than fetching all 1211+ rows to deduplicate client-side.

```sql
CREATE OR REPLACE FUNCTION public.get_distinct_enrollment_options()
RETURNS TABLE(batch_name text, subject_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ue.batch_name, ue.subject_name 
  FROM public.user_enrollments ue
  WHERE ue.batch_name IS NOT NULL AND ue.subject_name IS NOT NULL
  ORDER BY ue.batch_name, ue.subject_name;
$$;
```

### 2. Update AdminStaffManager.tsx to use the RPC function
Replace the raw table query with the RPC call:

```ts
const { data: rawEnrollments } = useQuery({
  queryKey: ['raw-enrollments-staff'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_distinct_enrollment_options');
    if (error) {
      console.error("Error fetching enrollments", error);
      return [];
    }
    return data || [];
  }
});
```

The `uniqueBatches` and `availableSubjects` `useMemo` computations remain the same since they already operate on `batch_name` and `subject_name` fields.

## Why This Fixes It
- **No row limit**: The RPC function returns only distinct pairs (51 rows), well under any limit
- **SECURITY DEFINER**: Bypasses RLS, so even if there's a policy evaluation issue, the admin gets all data
- **Database-side DISTINCT**: More efficient than fetching thousands of rows and deduplicating in JS

