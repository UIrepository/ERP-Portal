

# Plan: Dynamic URL Navigation & UI Restructure for Student Interface

## Overview

This plan restructures the student interface with the following key changes:

1. **Floating header** appears only on the initial batch/subject selection page, positioned below the navigation bar
2. **White sticky header** replaces the dark header when navigating into a subject, featuring a back arrow on the left
3. **Dynamic URL routing** reflects the current navigation state (batch, subject, block)
4. **Join Live Class block** added inside each subject view (combining ongoing/upcoming class functionality)
5. **Sidebar cleanup** - removes "Join Live Class", "Ongoing Class", and "Practice DPP" while keeping Schedule

---

## Architecture Overview

```text
URL Structure:
/                                    -> Dashboard (batch selection + subjects)
/?batch=JEE2025                      -> Dashboard with batch pre-selected
/?batch=JEE2025&subject=Physics      -> Subject blocks view
/?batch=JEE2025&subject=Physics&block=recordings -> Block content view
/?batch=JEE2025&subject=Physics&block=live-class -> Live class block
```

---

## Technical Implementation

### 1. Add URL Query Parameter Syncing

**File: `src/components/student/StudentMain.tsx`**

- Import `useSearchParams` from `react-router-dom`
- Sync navigation state with URL query parameters
- On mount, parse URL params to restore navigation state
- On navigation changes, update URL params using `setSearchParams`

Changes:
- Add `useSearchParams` hook
- Create `useEffect` to read initial state from URL
- Update all navigation handlers to also update URL params
- Handle browser back/forward navigation

### 2. Update Header Architecture

**File: `src/components/student/StudentBatchHeader.tsx`**

Keep as the dark floating header for the initial view (batch selection page only).

**New File: `src/components/student/StudentSubjectHeader.tsx`**

Create a new white sticky header for subject/block views:
- White background with subtle border/shadow
- Back arrow on the left side (after sidebar area)
- Breadcrumb showing: Batch > Subject > Block
- Clean, minimal design

### 3. Add Live Class Block to Subject View

**File: `src/components/student/StudentSubjectBlocks.tsx`**

Add a new "Live Class" block to the blocks array:
- ID: `live-class`
- Label: "Join Live Class"
- Description: "Ongoing & upcoming classes"
- Icon: Video with live indicator
- Gradient: Green/Emerald for live emphasis

**New File: `src/components/student/StudentLiveClass.tsx`**

Create a combined live class component:
- Shows ongoing classes (LIVE NOW) for the selected batch/subject
- Shows upcoming classes for today
- Join button opens meeting link
- Filtered by the current batch and subject context
- Merges functionality from `StudentJoinClass` and `StudentCurrentClass`

### 4. Update Block Content Router

**File: `src/components/student/StudentBlockContent.tsx`**

- Add case for `live-class` block
- Import and render `StudentLiveClass` component
- Pass batch and subject props

### 5. Update Subject Blocks View Header

**File: `src/components/student/StudentSubjectBlocks.tsx`**

Replace the dark gradient header with the new white sticky header:
- Back arrow at the start
- Breadcrumb navigation
- Remove the dark gradient styling

### 6. Update Block Content View Header

**File: `src/components/student/StudentBlockContent.tsx`**

Replace the dark gradient header with the new white sticky header:
- Consistent with subject blocks view
- Back navigation to subject blocks
- Full breadcrumb: Batch > Subject > Block

### 7. Simplify Sidebar for Students

**File: `src/components/Sidebar.tsx`**

Update `studentTabs` array:
- KEEP: "My Learning" (dashboard)
- KEEP: "Schedule" (moved here from subject blocks)
- REMOVE: "Join Live Class"
- REMOVE: "Ongoing Class"
- REMOVE: "Practice (DPP)"
- KEEP: "Submit Feedback"
- KEEP: "Exams"
- KEEP: "Contact Admin"

New student tabs:
```typescript
const studentTabs = [
  { id: 'dashboard', label: 'My Learning', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'feedback', label: 'Submit Feedback', icon: MessageSquare },
  { id: 'exams', label: 'Exams', icon: BookOpen },
  { id: 'contact-admin', label: 'Contact Admin', icon: Phone },
];
```

### 8. Update StudentDashboard Tab Handling

**File: `src/components/StudentDashboard.tsx`**

- Remove cases for `join-class`, `current-class`, and `dpp`
- Keep the `schedule` case for the sidebar schedule access
- Ensure `schedule` tab renders `StudentSchedule` component

---

## Visual Design Specifications

### White Sticky Header (for subject/block views)

```
+--------------------------------------------------+
| [<- Back]  Batch > Subject > Block               |
+--------------------------------------------------+
```

- Background: `bg-white`
- Border bottom: `border-b border-slate-200`
- Shadow: `shadow-sm`
- Padding: Consistent with content area
- Back arrow: Slate gray, hover effect
- Breadcrumb: Small text, arrows between items

### Live Class Block Card

- Prominent green/emerald gradient background
- Live pulse indicator when class is ongoing
- "Join Now" button with external link icon
- Shows class time and subject

---

## URL State Management Logic

```typescript
// Reading from URL on mount
useEffect(() => {
  const batch = searchParams.get('batch');
  const subject = searchParams.get('subject');
  const block = searchParams.get('block');
  
  if (batch) {
    setNavigation({
      level: block ? 'block' : (subject ? 'subject' : 'batch'),
      batch,
      subject: subject || null,
      block: block || null,
    });
  }
}, []);

// Writing to URL on navigation change
const updateUrl = (nav: NavigationState) => {
  const params = new URLSearchParams();
  if (nav.batch) params.set('batch', nav.batch);
  if (nav.subject) params.set('subject', nav.subject);
  if (nav.block) params.set('block', nav.block);
  setSearchParams(params, { replace: true });
};
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/student/StudentSubjectHeader.tsx` | White sticky header with back navigation |
| `src/components/student/StudentLiveClass.tsx` | Combined live/upcoming class view |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/student/StudentMain.tsx` | Add URL sync with useSearchParams |
| `src/components/student/StudentSubjectBlocks.tsx` | Use white header, add live-class block |
| `src/components/student/StudentBlockContent.tsx` | Use white header, add live-class case |
| `src/components/Sidebar.tsx` | Remove join-class, current-class, dpp from student tabs |
| `src/components/StudentDashboard.tsx` | Remove unused tab cases |

---

## Expected Outcome

1. **Initial Dashboard**: Shows floating dark header with batch name, subject cards below
2. **Subject View**: White sticky header with back arrow, block grid including "Live Class"
3. **Block View**: White sticky header with breadcrumb, block content
4. **URLs Update**: Every navigation action updates the URL for shareable links and browser history
5. **Sidebar Simplified**: Only essential items remain (My Learning, Schedule, Feedback, Exams, Contact)
6. **Live Class Integrated**: Join ongoing/upcoming classes from within subject context

