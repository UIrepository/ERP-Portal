

# Fix: Recording Date/Time Showing in GMT Instead of IST

## Root Cause

Two issues in `src/hooks/useYoutubeStream.ts` (line 56):

```typescript
date: new Date().toISOString(),
```

1. **Date column**: The `date` column in `recordings` is type `date` (no timezone). `new Date().toISOString()` produces a UTC string like `2026-03-05T23:30:00.000Z`. Postgres extracts just the date part **in UTC**, so a class started at 1:00 AM IST on March 6th gets stored as **March 5th** (the UTC date).

2. **Time display**: The `created_at` column defaults to `now()` in Postgres (UTC). The frontend uses `format(new Date(recording.created_at), 'h:mm a')` from `date-fns`, which formats in the **browser's local timezone** -- so this should already show IST for Indian users. However, if users are seeing GMT, it may be because the `created_at` value returned by Supabase lacks the timezone offset in some edge cases.

## Fix

### File: `src/hooks/useYoutubeStream.ts`

Change the `date` field from UTC ISO string to a **local date string** formatted as `yyyy-MM-dd` using `date-fns`'s `format()` (which uses local timezone):

```typescript
// Before
date: new Date().toISOString(),

// After
date: format(new Date(), 'yyyy-MM-dd'),
```

This ensures the date stored matches the teacher's local date (IST), not UTC.

### File: `src/components/student/StudentRecordings.tsx` and `src/components/teacher/TeacherRecordings.tsx`

The time display line:
```typescript
format(new Date(recording.created_at), 'h:mm a')
```

`date-fns` `format()` already uses the browser's local timezone. This should be correct. No change needed here -- if the date fix above resolves the user's concern, we're done. The `created_at` timestamps from Supabase are `timestamptz` and JS `new Date()` handles timezone conversion automatically.

## Summary

| File | Change |
|------|--------|
| `src/hooks/useYoutubeStream.ts` | Use `format(new Date(), 'yyyy-MM-dd')` for date field instead of `new Date().toISOString()` |

