
# Plan: Professional UI/UX with Context-Aware Content Filtering

## Overview
This plan enhances the student interface to display content specific to the selected batch and subject, removing redundant filters from content views (except Schedule and Community). The floating header will be updated to match the reference design, showing the combined "Batch Name - Subject Name" format.

---

## Technical Implementation

### 1. Update Floating Header Component

**File: `src/components/student/StudentBatchHeader.tsx`**

Modify the header to:
- Display "SELECTED BATCH" label with the format "Batch Name - Subject Name" when subject is selected
- Show just batch name when at batch/subject selection level
- Add a subtle menu dots icon on the right (matching reference image)
- Improve the rounded corner styling to match the reference

**Changes:**
- Add optional `subject` prop to component
- Update display logic to show combined format when subject is present
- Add `MoreVertical` icon on the right side

---

### 2. Update StudentBlockContent to Pass Context

**File: `src/components/student/StudentBlockContent.tsx`**

Modify to pass `batch` and `subject` props to child content components:
- `StudentRecordings` receives `batch` and `subject`
- `StudentNotes` receives `batch` and `subject`
- `StudentUIKiPadhai` receives `batch` and `subject`
- `StudentAnnouncements` receives `batch` and `subject`
- `StudentSchedule` and `StudentCommunity` keep their existing behavior (with filters)

---

### 3. Refactor StudentRecordings Component

**File: `src/components/student/StudentRecordings.tsx`**

Major changes:
- Add `batch` and `subject` props (optional for backward compatibility)
- When props are provided, filter data directly by those values
- Remove the batch/subject filter dropdowns from UI
- Keep only the search input for finding recordings by topic
- Update query to filter by exact batch and subject combination
- Remove all filter-related state and cascading logic

---

### 4. Refactor StudentNotes Component

**File: `src/components/student/StudentNotes.tsx`**

Major changes:
- Add `batch` and `subject` props
- When props are provided, query only that specific batch/subject combination
- Remove batch/subject filter dropdowns from UI
- Keep only search input for filtering notes by title/filename
- Simplify the component significantly

---

### 5. Refactor StudentUIKiPadhai Component

**File: `src/components/student/StudentUIKiPadhai.tsx`**

Major changes:
- Add `batch` and `subject` props
- When props are provided, filter content to that specific combination
- Remove batch/subject filter dropdowns from UI
- Keep search input for content discovery
- Maintain the premium content styling

---

### 6. Refactor StudentAnnouncements Component

**File: `src/components/student/StudentAnnouncements.tsx`**

Major changes:
- Add `batch` and `subject` props
- Filter announcements to show only those targeted at the specific batch/subject
- Include global announcements (where target_batch or target_subject is null)
- No filters needed in this view - just show relevant announcements

---

### 7. Keep Filters in Schedule and Community

**Files: `StudentSchedule.tsx` and `StudentCommunity.tsx`**

These components will retain their filter functionality as requested:
- **Schedule**: Keep batch filter since students may want to see schedules across batches
- **Community**: Keep the group selection (batch/subject combination) as it's core to the chat functionality

---

### 8. Update StudentSubjectBlocks Header

**File: `src/components/student/StudentSubjectBlocks.tsx`**

Update header to show "SELECTED BATCH" format matching the main header design for consistency.

---

## UI/UX Improvements

### Header Styling (Matching Reference)
- Dark gradient background: `from-slate-900 via-slate-800 to-slate-900`
- More rounded corners on the header container
- "SELECTED BATCH" label in muted cyan/slate color
- Large bold white text for "Batch Name - Subject Name"
- Dropdown chevron next to text when switchable
- Subtle menu icon (three dots) on the right
- Subtle dot pattern overlay for texture (optional)

### Content Areas
- Clean, filter-free layouts for Recordings, Notes, UI Ki Padhai, Announcements
- Professional skeleton loaders
- Consistent empty state designs
- Proper spacing and typography hierarchy

---

## Data Flow Diagram

```text
StudentMain (manages navigation state)
    |
    +-- navigation.batch (selected batch)
    +-- navigation.subject (selected subject)
    +-- navigation.block (selected content block)
    |
    v
StudentBlockContent (receives batch, subject, blockId)
    |
    +-- StudentRecordings (batch, subject) --> Direct filter, no UI filters
    +-- StudentNotes (batch, subject) --> Direct filter, no UI filters
    +-- StudentUIKiPadhai (batch, subject) --> Direct filter, no UI filters
    +-- StudentAnnouncements (batch, subject) --> Direct filter, no UI filters
    +-- StudentSchedule () --> Keeps internal filters
    +-- StudentCommunity () --> Keeps group selection
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `StudentBatchHeader.tsx` | Add subject prop, update display format, add menu icon |
| `StudentBlockContent.tsx` | Pass batch/subject to child components |
| `StudentRecordings.tsx` | Add props, remove filter UI, direct query by batch/subject |
| `StudentNotes.tsx` | Add props, remove filter UI, direct query by batch/subject |
| `StudentUIKiPadhai.tsx` | Add props, remove filter UI, filter by batch/subject |
| `StudentAnnouncements.tsx` | Add props, filter announcements by batch/subject |
| `StudentSubjectBlocks.tsx` | Update header style for consistency |

---

## Expected Outcome

- **Professional Header**: Shows "Batch Name - Subject Name" like the reference image
- **Context-Aware Content**: All content blocks show only materials for the selected batch and subject
- **No Redundant Filters**: Recordings, Notes, UI Ki Padhai, and Announcements have clean UIs without filter dropdowns
- **Preserved Functionality**: Schedule and Community keep their filter capabilities as requested
- **Consistent Experience**: Unified design language across all student-facing components
