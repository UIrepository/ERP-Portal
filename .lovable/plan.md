

# Feature: Show Completed Classes for Today

## Problem

Currently, the classification logic (lines 175-194) only shows classes that are either "Live Now" (within start-15min to end+15min buffer) or "Upcoming" (within 4 hours). Once a class ends and passes the buffer, it disappears entirely. Students lose visibility of what classes were held today.

## Desired Behavior

- If a class's `active_classes` entry is still active (`is_jitsi_live = true`), keep showing it as "Live Now" regardless of scheduled end time (teacher is still in class).
- If the scheduled end time has passed AND `is_jitsi_live = false`, show it as "Completed" -- a greyed-out card with no join button.
- Upcoming and Live classes remain as-is.

## Changes

### File: `src/components/student/StudentLiveClass.tsx`

**Add a third category: `completedClasses`** in the classification logic (lines 171-194):

```typescript
const liveClasses: ScheduleWithLink[] = [];
const upcomingClasses: ScheduleWithLink[] = [];
const completedClasses: ScheduleWithLink[] = [];

schedules?.forEach(schedule => {
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  
  const startTime = new Date(today);
  startTime.setHours(startHour, startMin, 0, 0);
  
  const endTime = new Date(today);
  endTime.setHours(endHour, endMin, 0, 0);
  
  const bufferStart = addMinutes(startTime, -15);
  const bufferEnd = addMinutes(endTime, 15);

  // If teacher is still live, always show as Live Now
  if (schedule.is_jitsi_live) {
    liveClasses.push(schedule);
  }
  // Within schedule window (not live but in buffer)
  else if (isWithinInterval(now, { start: bufferStart, end: bufferEnd })) {
    liveClasses.push(schedule);
  }
  // Upcoming (hasn't started yet, within 4 hours)
  else if (now < startTime && differenceInMinutes(startTime, now) < 240) {
    upcomingClasses.push(schedule);
  }
  // Completed (start time has passed, not live anymore)
  else if (now > startTime && !schedule.is_jitsi_live) {
    completedClasses.push(schedule);
  }
});
```

**Update `allClasses`** to include completed:
```typescript
const allClasses = [...liveClasses, ...upcomingClasses, ...completedClasses];
```

**Add completed class card rendering** after the upcoming classes section -- a muted card showing subject, batch, time, and a "Class Completed" badge. No join button.

```tsx
{completedClasses.map((item) => (
  <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-[4px] p-6 flex flex-col justify-between min-h-[180px] opacity-70">
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-green-600">
          Completed
        </span>
      </div>
      <h2 className="text-[16px] font-semibold text-slate-600 mb-1">{item.subject}</h2>
      <p className="text-[13px] text-slate-400">{item.batch}</p>
    </div>
    <div className="flex items-center justify-between mt-auto">
      <span className="text-[13px] text-slate-500">{formatTimeRange(...)}</span>
      <span className="text-[12px] text-slate-400 bg-slate-100 px-2.5 py-1 border border-slate-200 rounded-[4px]">
        Class Over
      </span>
    </div>
  </div>
))}
```

**Update page title** from "Live Class Sessions" to "Today's Classes" since it now shows all classes for the day.

## Summary

| File | Change |
|------|--------|
| `src/components/student/StudentLiveClass.tsx` | Add `completedClasses` category, prioritize `is_jitsi_live` for live status, render completed cards, rename title |

