

# Student Messaging Refactor Plan

## Overview

This plan introduces a professional, unified **Right-Side Chat Drawer (Sheet)** for all 1:1 direct messaging in the student portal. The system will have two distinct entry points - "Support" from the sidebar and "Subject Connect" from within subject cards - but both will use the same underlying drawer component with different configurations.

---

## Architecture Summary

```text
+---------------------+       +------------------------+
|     STUDENT UI      |       |   UNIFIED CHAT DRAWER  |
+---------------------+       +------------------------+
        |                              |
        |-- Sidebar "Support" -------->| Role Selection View
        |                              |   - Admin Card
        |                              |   - Manager Card
        |                              |        |
        |                              |        v
        |                              |   Chat View (Anonymous)
        |                              |
        |-- Subject Card "Connect" --->| Direct Chat View
        |                              |   (Context: "Physics Mentor")
        +------------------------------+
```

---

## Detailed Implementation Plan

### Phase 1: Database Schema Updates

**Add a `message_context` column to the `direct_messages` table** to categorize conversations for staff filtering.

**SQL Migration:**
```sql
-- Add context column to distinguish message types
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'general';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_direct_messages_context 
ON public.direct_messages(context);

-- Add subject context for teacher chats
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS subject_context TEXT DEFAULT NULL;
```

The `context` field will have values like:
- `support_admin` - Technical support tickets
- `support_manager` - Batch issue tickets  
- `subject_doubt` - Subject-specific teacher chats
- `general` - Legacy/default

---

### Phase 2: Create Unified Chat Drawer Component

**New File: `src/components/student/StudentChatDrawer.tsx`**

This single component will handle both workflows with different initial states:

**Props Interface:**
```typescript
interface StudentChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Mode determines initial view
  mode: 'support' | 'subject-connect';
  // For subject-connect mode only
  subjectContext?: {
    batch: string;
    subject: string;
  };
}
```

**Component Structure:**
1. **Role Selection View** (for `support` mode)
   - Two clean rectangular cards:
     - "Admin" card - icon: `Shield`, subtitle: "Technical Support"
     - "Manager" card - icon: `Briefcase`, subtitle: "Batch Issues"
   - On click: Fetch appropriate staff member and transition to Chat View

2. **Chat View** (for both modes)
   - Context-aware header:
     - Support mode: "Support Agent" (anonymous)
     - Subject mode: "{Subject} Mentor" (e.g., "Physics Mentor")
   - Full message history from `direct_messages` table
   - Real-time polling (3-second interval)
   - Message input with send button

**Key Features:**
- Uses the existing `Sheet` component from `@/components/ui/sheet`
- Slides in from the right side
- Fixed height with internal scrolling for messages
- Preserves conversation history across sessions

---

### Phase 3: Support Workflow (Sidebar Trigger)

**Modify: `src/components/Sidebar.tsx`**

Add a new "Support" tab to the student tabs array:
```typescript
const studentTabs = [
  { id: 'dashboard', label: 'My Learning', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'support', label: 'Support', icon: Headphones }, // NEW
  { id: 'feedback', label: 'Submit Feedback', icon: MessageSquare },
  { id: 'exams', label: 'Exams', icon: BookOpen },
  { id: 'contact-admin', label: 'Contact Admin', icon: Phone },
];
```

**Behavior:**
- Clicking "Support" opens the Chat Drawer in `support` mode
- The drawer shows the Role Selection View first
- Student picks Admin or Manager
- System fetches the first available staff member assigned to the student's batch
- Transition to Chat View with "Support Agent" header (anonymous)

**Staff Lookup Logic:**
```typescript
// For Admin support
const { data: admin } = await supabase
  .from('admins')
  .select('user_id, name')
  .limit(1)
  .single();

// For Manager support
const { data: manager } = await supabase
  .from('managers')
  .select('user_id, name, assigned_batches')
  .overlaps('assigned_batches', studentBatches)
  .limit(1)
  .single();
```

---

### Phase 4: Subject Connect Workflow (Subject Card Trigger)

**Modify: `src/components/student/StudentSubjectBlocks.tsx`**

The existing "Connect" block (id: `connect`) will be enhanced:
- Instead of navigating to `StudentBlockContent`, it opens the Chat Drawer in `subject-connect` mode
- Automatically fetches the teacher assigned to both the batch AND subject

**Teacher Lookup Logic:**
```typescript
const { data: teacher } = await supabase
  .from('teachers')
  .select('user_id, name')
  .contains('assigned_batches', [batch])
  .contains('assigned_subjects', [subject])
  .limit(1)
  .single();
```

**Behavior:**
- Student clicks "Connect" block within a subject (e.g., Physics)
- Drawer opens directly to Chat View (bypasses role selection)
- Header shows "{Subject} Mentor" (e.g., "Physics Mentor")
- Full chat history with that specific teacher is loaded
- Messages are tagged with `context: 'subject_doubt'` and `subject_context: 'Physics'`

---

### Phase 5: Enhanced Staff Inbox

**Modify: `src/components/shared/StaffInbox.tsx`**

Add category filtering and context badges to help staff manage their inboxes:

**New Features:**
1. **Tab-based filtering** at the top:
   - "All" - Shows all conversations
   - "Support Tickets" - Filters `context IN ('support_admin', 'support_manager')`
   - "Subject Doubts" - Filters `context = 'subject_doubt'`

2. **Context Badges** on each contact card:
   - Support tickets: Red badge with "Support"
   - Subject doubts: Blue badge with the subject name (e.g., "Physics")

3. **Enhanced Contact Query:**
```typescript
// Modified query to include message context
const { data: messages } = await supabase
  .from('direct_messages')
  .select('*, context, subject_context')
  .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  .order('created_at', { ascending: false });
```

---

### Phase 6: State Management

**New File: `src/hooks/useChatDrawer.tsx`**

A simple context/hook to manage the drawer state across components:

```typescript
interface ChatDrawerState {
  isOpen: boolean;
  mode: 'support' | 'subject-connect';
  subjectContext?: { batch: string; subject: string };
  selectedRecipient?: { id: string; name: string; displayName: string };
}

// Provides: openSupportDrawer(), openSubjectConnect(batch, subject), closeDrawer()
```

This hook will be used by:
- `Sidebar.tsx` - to open support drawer
- `StudentSubjectBlocks.tsx` - to open subject connect drawer
- `StudentMain.tsx` - to render the drawer component

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/student/StudentChatDrawer.tsx` | **Create** | New unified chat drawer component |
| `src/hooks/useChatDrawer.tsx` | **Create** | State management hook for drawer |
| `src/components/Sidebar.tsx` | **Modify** | Add "Support" tab, integrate drawer trigger |
| `src/components/student/StudentSubjectBlocks.tsx` | **Modify** | Wire "Connect" block to drawer |
| `src/components/student/StudentMain.tsx` | **Modify** | Add ChatDrawerProvider and render drawer |
| `src/components/shared/StaffInbox.tsx` | **Modify** | Add filtering tabs and context badges |
| Database Migration | **Create** | Add `context` and `subject_context` columns |

---

## Critical Constraints

1. **DO NOT TOUCH `StudentCommunity.tsx`** - The existing community feature remains completely unchanged
2. **Preserve existing `direct_messages` data** - The migration adds columns with defaults, no data loss
3. **Keep `StudentConnect.tsx` functional** - It will continue to work for the "Support Connect" tab but will be enhanced with the drawer

---

## Technical Details

### Message Context Values
- `support_admin` - Message to admin via support workflow
- `support_manager` - Message to manager via support workflow
- `subject_doubt` - Message to teacher via subject connect
- `general` - Default/legacy messages

### Anonymous Display Logic
```typescript
// In Chat View header
const displayName = mode === 'support' 
  ? 'Support Agent' 
  : `${subjectContext.subject} Mentor`;
```

### Real-time Sync
Messages will use the existing 3-second polling pattern already in `StudentDirectMessage.tsx`, which works reliably without complex WebSocket setup.

---

## UI/UX Specifications

**Drawer Dimensions:**
- Width: `sm:max-w-md` (448px) on desktop
- Height: Full viewport height
- Side: Right

**Role Selection Cards:**
- Height: ~100px each
- Border: 1px slate-200, hover: black
- Icon: 40x40px in a colored circle
- Layout: Icon left, text right

**Chat View:**
- Header: 56px fixed with avatar and name
- Messages: Scrollable area with `flex-1`
- Input: 64px fixed at bottom

