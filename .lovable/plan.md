
# Floating Chatbot Widget Refactor Plan

## Overview

This plan replaces the right-side sheet drawer with a **floating chatbot widget** (similar to Intercom/Drift) that appears in the bottom-right corner of the screen. It also fixes the manager availability issue by improving the fallback logic.

---

## Architecture Summary

```text
+---------------------------+
|      STUDENT PORTAL       |
|                           |
|                           |
|                           |
|                   +-------+
|                   | FAB   | <-- Floating Action Button (bottom-right)
+-------------------+-------+

When clicked:

+---------------------------+
|      STUDENT PORTAL       |
|            +--------------+
|            |  CHATBOT     |
|            |  WINDOW      |
|            |              |
|            | [Welcome Msg]|
|            | [Options]    |
|            | [Chat Area]  |
+------------+--------------+
```

---

## Problem 1: Manager "Not Available" Error

### Root Cause
The `managers` table has records but with `user_id: null`. The code correctly filters these out, but when no manager has a valid `user_id`, the error message appears.

### Solution
1. **Improve error messaging**: Instead of a generic toast, show a helpful inline message in the chatbot
2. **Add fallback to admin**: If no manager is available, offer to connect to admin instead
3. **Better data validation**: Display available options only when staff members exist with valid `user_id`

---

## Problem 2: Convert Sheet to Floating Chatbot Widget

### Current Implementation
- Uses `Sheet` component sliding in from the right
- Triggered from sidebar "Support" tab or subject "Connect" block
- Role selection cards inside sheet

### New Implementation
A floating chatbot widget with these characteristics:

**Floating Action Button (FAB):**
- Fixed position: bottom-right corner (`fixed bottom-6 right-6`)
- Circular button with chat/headphone icon
- Pulse animation when there are unread messages (future)
- Click to toggle chatbot window open/close

**Chatbot Window:**
- Positioned above FAB (`bottom-20 right-6`)
- Fixed dimensions: `w-[380px] h-[500px]`
- Rounded corners with shadow
- Three views:
  1. **Welcome View** - Initial greeting with option buttons
  2. **Chat View** - Message history and input
  3. **Loading View** - Connecting animation

---

## Detailed Implementation

### Phase 1: Create Floating Chatbot Component

**New File: `src/components/student/StudentChatbot.tsx`**

**Component Structure:**
```typescript
interface ChatbotState {
  isOpen: boolean;
  view: 'welcome' | 'chat' | 'loading';
  chatMode?: 'support-admin' | 'support-manager' | 'subject-doubt';
  recipient?: { id: string; name: string; displayName: string };
  subjectContext?: { batch: string; subject: string };
}
```

**Welcome View Features:**
- Bot avatar with greeting message bubble: "Hi! I'm here to help. Who would you like to connect with?"
- Three rectangular option blocks:
  1. **"Talk to Admin"** - For technical support issues
  2. **"Talk to Manager"** - For batch-related issues  
  3. **"Talk to Teacher"** - Only shown when triggered from subject context
- Each block has icon, title, and subtitle
- Hover effect with border color change

**Chat View Features:**
- Header with recipient avatar and display name
- Back button to return to welcome view
- Scrollable message area
- Message input with send button
- Messages styled as bubbles (right-aligned for user, left for recipient)

### Phase 2: Update State Management Hook

**Modify: `src/hooks/useChatDrawer.tsx`**

Rename to `useChatbot.tsx` (or keep same name for compatibility) and update:
- Change `isOpen` to manage chatbot visibility
- Add `view` state for internal navigation
- Keep `mode` and `subjectContext` for different entry points
- Add `toggleChatbot()` function for FAB click

### Phase 3: Fix Manager Lookup with Better Fallback

**Updated Logic in `StudentChatbot.tsx`:**

```typescript
const fetchManager = async (studentBatches: string[]) => {
  const { data, error } = await supabase
    .from('managers')
    .select('user_id, name, assigned_batches')
    .not('user_id', 'is', null);  // Only get managers with linked users
  
  if (error || !data || data.length === 0) {
    // No managers with user_id exist - return null but don't show error
    // The UI will handle showing alternative options
    return null;
  }

  // Find manager whose assigned_batches overlaps with student batches
  const matchingManager = data.find(manager => 
    manager.assigned_batches?.some((b: string) => studentBatches.includes(b))
  );

  // If no batch-specific manager, try any available manager
  return matchingManager || data[0];
};
```

**UI Fallback:**
When manager is not available, the chatbot shows:
```
"No manager is currently assigned to your batch. 
Would you like to talk to an Admin instead?"
[Talk to Admin] [Cancel]
```

### Phase 4: Pre-fetch Available Staff

Before showing options, check what's actually available:

```typescript
const { data: availableStaff } = useQuery({
  queryKey: ['available-support-staff', profile?.user_id],
  queryFn: async () => {
    const [admins, managers] = await Promise.all([
      supabase.from('admins').select('user_id').not('user_id', 'is', null),
      supabase.from('managers').select('user_id, assigned_batches').not('user_id', 'is', null)
    ]);
    
    return {
      hasAdmin: (admins.data?.length || 0) > 0,
      hasManager: (managers.data?.length || 0) > 0,
      managers: managers.data || []
    };
  }
});
```

Only show options that are actually available (disable or hide unavailable options).

### Phase 5: Update Trigger Points

**1. Sidebar "Support" Tab:**
Instead of opening a drawer, it toggles the floating chatbot with `welcome` view.

**Modify: `src/components/Sidebar.tsx`**
- Change `onSupportClick` behavior to toggle chatbot instead of opening drawer
- The chatbot opens in "support" mode showing Admin/Manager options

**2. Subject "Connect" Block:**
Opens chatbot directly in loading state, fetches teacher, then shows chat.

**Modify: `src/components/student/StudentSubjectBlocks.tsx`**
- Change `openSubjectConnect` to open chatbot with subject context
- Welcome message shows: "Connecting you to your {Subject} mentor..."
- After teacher is fetched, transitions to chat view

### Phase 6: Integration

**Modify: `src/pages/Index.tsx`**
- Replace `<StudentChatDrawer />` with `<StudentChatbot />`
- Keep `ChatDrawerProvider` (renamed internally but API compatible)

---

## UI Specifications

### Floating Action Button (FAB)
- Size: `56px` (w-14 h-14)
- Position: `fixed bottom-6 right-6 z-50`
- Background: Primary color (slate-900)
- Icon: `MessageCircle` or `Headphones`
- Hover: Scale up slightly, shadow increase
- Open state: Icon changes to `X` (close)

### Chatbot Window
- Size: `w-[380px] h-[500px]` (fixed)
- Position: `fixed bottom-24 right-6 z-50`
- Background: White
- Border: `border border-slate-200`
- Shadow: `shadow-2xl`
- Border radius: `rounded-2xl`
- Animation: Fade + slide up on open

### Welcome View Layout
```
+-----------------------------------+
|  [X]                    Unknown IITians |
+-----------------------------------+
|                                   |
|    [Bot Avatar]                   |
|                                   |
|    "Hi! 👋 I'm here to help.      |
|     Who would you like to         |
|     connect with?"                |
|                                   |
+-----------------------------------+
|  +-----------------------------+  |
|  | [Icon]  Talk to Admin       |  |
|  |         Technical Support   |  |
|  +-----------------------------+  |
|                                   |
|  +-----------------------------+  |
|  | [Icon]  Talk to Manager     |  |
|  |         Batch Issues        |  |
|  +-----------------------------+  |
|                                   |
+-----------------------------------+
```

### Chat View Layout
```
+-----------------------------------+
|  [<]  Support Agent       [?]     |
+-----------------------------------+
|                                   |
|  [Bot msg bubble]                 |
|                                   |
|              [User msg bubble]    |
|                                   |
|  [Bot msg bubble]                 |
|                                   |
+-----------------------------------+
|  [Input field...        ] [Send]  |
+-----------------------------------+
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/student/StudentChatbot.tsx` | **Create** | New floating chatbot widget component |
| `src/components/student/StudentChatDrawer.tsx` | **Delete** | Remove old sheet-based drawer |
| `src/hooks/useChatDrawer.tsx` | **Modify** | Update for chatbot state management |
| `src/components/Sidebar.tsx` | **Modify** | Update support click behavior |
| `src/components/student/StudentSubjectBlocks.tsx` | **Modify** | Update connect trigger |
| `src/pages/Index.tsx` | **Modify** | Replace drawer with chatbot component |

---

## Technical Notes

### Why Floating Widget Over Sheet?
1. **Always accessible**: FAB is always visible, users don't need to navigate to sidebar
2. **Context preservation**: Chat stays open while browsing other content
3. **Modern UX pattern**: Familiar from Intercom, Drift, etc.
4. **Better mobile experience**: Doesn't take full screen width

### Manager Fallback Logic
```typescript
// Priority order for manager lookup:
// 1. Manager with matching batch AND valid user_id
// 2. Any manager with valid user_id
// 3. Offer admin as fallback
// 4. Show "support unavailable" with contact info
```

### Message Persistence
All messages continue to be stored in `direct_messages` table with proper `context` and `subject_context` values for staff inbox filtering.
