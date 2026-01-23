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
  return `class${cleanBatch}${cleanSubject}${today}`;
};

/**
 * Normalizes a subject name for comparison.
 * Removes batch/quiz suffixes in parentheses: "Maths 2 (QUIZ 1)" -> "maths 2"
 */
export const normalizeSubjectForComparison = (subject: string): string => {
  return subject
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove parentheses suffix
    .trim()
    .toLowerCase();
};

/**
 * Checks if two subject names match (using normalization).
 * Handles cases like: "Maths 2" matching "Maths 2 (QUIZ 1)"
 */
export const subjectsMatch = (subject1: string, subject2: string): boolean => {
  const norm1 = normalizeSubjectForComparison(subject1);
  const norm2 = normalizeSubjectForComparison(subject2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  return norm1.includes(norm2) || norm2.includes(norm1);
};
