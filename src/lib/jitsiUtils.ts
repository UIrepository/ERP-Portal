import { format } from 'date-fns';

/**
 * Generates a consistent room name for Jitsi meetings.
 */
export const generateJitsiRoomName = (batch: string, subject: string): string => {
  const today = format(new Date(), 'yyyyMMdd');
  const cleanBatch = batch.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `class${cleanBatch}${cleanSubject}${today}`;
};

export const normalizeSubjectForComparison = (subject: string): string => {
  return subject.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
};

export const subjectsMatch = (subject1: string, subject2: string): boolean => {
  const norm1 = normalizeSubjectForComparison(subject1);
  const norm2 = normalizeSubjectForComparison(subject2);
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
};

// --- CENTRALIZED SECURITY LOGIC ---
export const generateStudentJitsiUrl = (meetingLink: string, displayName: string) => {
  if (!meetingLink) return "";
  
  // Only apply restrictions to Jitsi links
  if (!meetingLink.includes('meet.jit.si')) return meetingLink;

  try {
    const urlObj = new URL(meetingLink);
    
    // These configurations force the Jitsi interface to hide teacher controls
    const configParams = [
      // 1. Disable Live Streaming
      `config.liveStreamingEnabled=false`,
      
      // 2. Disable Recording (Dropbox/Local)
      `config.fileRecordingsEnabled=false`,
      `config.localRecording.enabled=false`, 
      
      // 3. Disable Remote Control
      `config.disableRemoteMute=true`,        // Prevent students muting others
      `config.remoteVideoMenu.disableKick=true`, // Prevent kicking
      `config.remoteVideoMenu.disableGrantModerator=true`, // Prevent promoting others

      // 4. UI Cleanup
      `config.prejoinPageEnabled=false`,      
      `userInfo.displayName="${displayName}"` 
    ];

    urlObj.hash = configParams.join('&');
    return urlObj.toString();
  } catch (e) {
    console.error("Invalid URL:", meetingLink);
    return meetingLink;
  }
};
