// App feature flags.
//
// Attendance is OFF for now: students join classes externally (in a new tab),
// so class_attendance is essentially never populated and the panels showed
// nothing useful while adding needless queries. Flip to `true` to restore the
// staff attendance panels and the join/leave recording.
export const ATTENDANCE_ENABLED = false;
