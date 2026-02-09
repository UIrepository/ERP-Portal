

# Fix Merged Subjects: Same Room, Shared Content

## Problem
When two courses are merged (e.g., Batch A / Physics + Batch B / Physics), students joining a live class still end up in **different Jitsi rooms** because the room name is generated from `schedule.batch + schedule.subject`, which differs for each side. Also, the community chat realtime subscription only listens to one batch, so new messages from the merged batch don't appear in real-time.

## Solution

### 1. Consistent Jitsi Room Name for Merged Subjects

**File: `src/components/student/StudentLiveClass.tsx`**

When generating the Jitsi room name, instead of using `schedule.batch` and `schedule.subject`, use the **first merged pair** (which is always the same for both sides thanks to the `get_merged_pairs` function returning a deterministic set). This ensures all students in a merge group join the same room.

```text
Before: generateJitsiRoomName(schedule.batch, schedule.subject)
         Batch A -> room "classabatchaphysics20260209"
         Batch B -> room "classbatchbphysics20260209"

After:  generateJitsiRoomName(mergedPairs[0].batch, mergedPairs[0].subject)
         Batch A -> room "classabatchaphysics20260209"  (uses primary pair)
         Batch B -> room "classabatchaphysics20260209"  (same primary pair!)
```

The `get_merged_pairs` RPC always returns the original pair first, then any linked pairs. Since both sides of a merge return the same set (just in different order for the "self" entry), we need a deterministic "primary" -- we'll sort the merged pairs alphabetically and always use the first one as the canonical room name source.

### 2. Fix Community Chat Realtime Subscription

**File: `src/components/student/StudentCommunity.tsx`**

The realtime channel currently only listens to `filter: batch=eq.${selectedGroup.batch_name}`. When a merged student from the other batch posts a message, the subscription doesn't catch it.

Fix: Subscribe to **all merged batches** by creating a channel for each merged pair, or by removing the batch filter and relying on the broader table-level subscription (since the query itself already filters correctly with the OR filter).

The simplest approach: listen to `community_messages` changes without a batch filter on the channel, and let the query refetch handle the filtering. This is safe because the query already uses the `orFilter`.

### 3. Deduplicate Schedules in Live Class View

When merged, the component fetches schedules from both pairs. If both Batch A and Batch B have a Physics class at the same time, students would see **two** class cards. Add deduplication by time slot -- if two schedules overlap in time, keep only one (they're the same merged class).

---

## Technical Details

### Files to Modify

**`src/components/student/StudentLiveClass.tsx`**
- Add a `getPrimaryPair()` helper that sorts `mergedPairs` alphabetically and returns the first one
- Use this primary pair for `generateJitsiRoomName()` instead of `schedule.batch/subject`
- Add deduplication: after collecting all valid schedules from merged pairs, deduplicate by `start_time + end_time` to avoid showing the same class twice
- Also check `active_classes` across all merged pairs (already done) but use the primary pair's room URL

**`src/components/student/StudentCommunity.tsx`**
- Update the realtime subscription `useEffect` to subscribe to changes from all merged batches, not just the selected group's batch
- Use `communityOrFilter` dependency so the subscription updates when merges change

**`src/hooks/useMergedSubjects.ts`**
- Add a `primaryPair` return value: the alphabetically-first pair, used as the canonical identifier for shared resources like Jitsi rooms
- This ensures both sides of a merge always resolve to the same "primary" pair

