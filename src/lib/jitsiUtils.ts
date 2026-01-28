import { format } from 'date-fns';

/**
 * Generates a consistent room name for Jitsi meetings.
 * This ensures all participants (teachers, students, admins, managers) join the SAME room.
 */
export const generateJitsiRoomName = (batch: string, subject: string): string => {
  const today = format(new Date(), 'yyyyMMdd');
  // Normalize: remove special chars, lowercase, combine with date
  const cleanBatch = batch.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  // Using a prefix to prevent name collisions with public rooms
  return `erp_portal_${cleanBatch}_${cleanSubject}_${today}`;
};

export const normalizeSubjectForComparison = (subject: string): string => {
  return subject
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove parentheses suffix
    .trim()
    .toLowerCase();
};

export const subjectsMatch = (subject1: string, subject2: string): boolean => {
  const norm1 = normalizeSubjectForComparison(subject1);
  const norm2 = normalizeSubjectForComparison(subject2);
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
};
