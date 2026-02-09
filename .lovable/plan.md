

# Subject Merge System

## What This Feature Does

Think of it like combining two classrooms in school. When an admin merges "Physics from Batch A" with "Physics from Batch B", students from both batches will see the same recordings, notes, community chat, live classes, and schedules -- as if they were in one combined class. The admin can also undo (de-merge) this at any time.

## How It Works

A new database table called `subject_merges` stores which subjects are linked together. When a student opens their subject view, the system checks if their subject is merged with another and automatically pulls in content from both sides. No actual data is moved or duplicated -- it's a virtual merge.

```text
Before Merge:
  Batch A / Physics  -->  sees only Batch A Physics content
  Batch B / Physics  -->  sees only Batch B Physics content

After Merge:
  Batch A / Physics  -->  sees Batch A + Batch B Physics content
  Batch B / Physics  -->  sees Batch A + Batch B Physics content
```

## Admin Controls

A new "Subject Merges" tab in the Admin Portal where the admin can:
- Create a new merge by selecting two batch+subject pairs
- View all active merges
- De-merge (revert) any active merge instantly

---

## Technical Details

### 1. Database Migration

**New table: `subject_merges`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier |
| primary_batch | text | First batch name |
| primary_subject | text | First subject name |
| secondary_batch | text | Second batch name |
| secondary_subject | text | Second subject name |
| is_active | boolean | Whether merge is currently active |
| created_by | uuid | Admin who created it |
| created_at | timestamptz | When created |

**New database function: `get_merged_pairs(p_batch text, p_subject text)`**

A `SECURITY DEFINER` function that takes a batch+subject and returns all batch+subject pairs in its merge group (including itself). If no merge exists, it returns just the original pair. This is the core lookup that all student queries will use.

**RLS policies:**
- Admins get full CRUD access
- Authenticated users get SELECT access (needed for the frontend merge-aware queries)

### 2. Custom React Hook: `useMergedSubjects`

A new hook `src/hooks/useMergedSubjects.ts` that:
- Takes `(batch, subject)` as input
- Calls `get_merged_pairs` via Supabase RPC
- Returns an array of `{ batch, subject }` pairs
- Caches the result with React Query

### 3. Frontend Query Updates

The following student components currently query with `.eq('batch', batch).eq('subject', subject)`. They will be updated to use the merged pairs and query with `.or(...)` across all merged batch+subject combinations:

- **StudentRecordings** -- recordings from all merged subjects
- **StudentNotes** -- notes from all merged subjects
- **StudentCommunity** -- community messages from all merged subjects (shared chat)
- **StudentLiveClass** -- live classes from all merged subjects
- **StudentSchedule** -- schedules from all merged subjects
- **StudentUIKiPadhai** -- UI Ki Padhai content from all merged subjects
- **StudentDPP** -- DPP content from all merged subjects

Each component will import `useMergedSubjects` and build an OR filter like:
```
.or('and(batch.eq.BatchA,subject.eq.Physics),and(batch.eq.BatchB,subject.eq.Physics)')
```

### 4. Admin UI Component: `AdminSubjectMerges`

A new component `src/components/admin/AdminSubjectMerges.tsx` with:
- A form to create a merge (two dropdowns: select Batch+Subject for each side)
- A table showing all active merges with a "De-merge" button
- De-merge sets `is_active = false` (soft delete, preserving history)

### 5. Sidebar & Dashboard Integration

- Add a new tab `{ id: 'subject-merges', label: 'Subject Merges', icon: GitMerge }` to the admin sidebar
- Add the corresponding case in `AdminDashboard.tsx`

### 6. Files to Create
- `src/hooks/useMergedSubjects.ts` -- the merge-aware hook
- `src/components/admin/AdminSubjectMerges.tsx` -- admin management UI
- SQL migration for the table, function, and RLS policies

### 7. Files to Modify
- `src/components/Sidebar.tsx` -- add admin tab
- `src/components/admin/AdminDashboard.tsx` -- add tab case
- `src/components/student/StudentRecordings.tsx` -- use merged queries
- `src/components/student/StudentNotes.tsx` -- use merged queries
- `src/components/student/StudentCommunity.tsx` -- use merged queries
- `src/components/student/StudentLiveClass.tsx` -- use merged queries
- `src/components/student/StudentSchedule.tsx` -- use merged queries
- `src/components/student/StudentUIKiPadhai.tsx` -- use merged queries
- `src/components/student/StudentDPP.tsx` -- use merged queries

