

# Fix: STOP REC Button Disappears After Class End Time

## Problem
When a class passes its scheduled end time, it moves from "Currently Active" to "Completed". The completed section only shows a "View Attendance" button -- no STOP REC. If the teacher is still streaming, they lose the ability to stop the recording.

## Solution
Modify the classification logic so that **any class with an active `stream_key` stays in the "live" category**, regardless of whether the scheduled end time has passed.

## File to modify
`src/components/teacher/TeacherJoinClass.tsx`

## Changes

**Lines 254-265** -- Update the classification in the `useMemo` block:

Current logic:
```
if (isBefore(now, startTime))       -> upcoming
else if (isAfter(now, endTime))     -> completed
else                                -> live
```

New logic:
```
if (cls.stream_key)                 -> live (always, stream is active)
else if (isBefore(now, startTime))  -> upcoming
else if (isAfter(now, endTime))     -> completed
else                                -> live
```

This single change ensures that as long as the teacher has an active stream (stream_key is set), the class card stays visible in the "Currently Active" section with all its buttons (Join, STOP REC, Attendance) -- even if the scheduled time window has ended. Once the teacher clicks STOP REC (which clears stream_key), the card will naturally move to "Completed" on the next re-render.
