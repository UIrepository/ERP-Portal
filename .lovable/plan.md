
# Implementation Plan: Connect Video Cards to FullScreen Video Player

## Overview
This plan connects the existing recording cards in `StudentRecordings` to open the professional `FullScreenVideoPlayer` component, enabling a distraction-free viewing experience with custom controls and integrated doubts/lecture navigation.

## What Will Change

### User Experience
- Clicking any lecture card opens a full-screen dark-themed video player
- The player shows custom controls (play/pause, seek, speed, volume) that auto-hide
- A right sidebar allows students to:
  - **Doubts tab**: Ask questions and see answers from instructors
  - **Lectures tab**: Navigate to other lectures in the same subject
- Students can switch lectures without leaving the player
- Pressing ESC or clicking the X button closes the player

## Implementation Steps

### Step 1: Add Fullscreen Player State
Add new state variables to `StudentRecordings` to manage when the fullscreen player is open and which lecture is playing.

### Step 2: Create Data Transformation Functions
Build helper functions to convert:
- `RecordingContent` (database format) to `Lecture` (player format)
- Database doubts to the `Doubt` format expected by the player

### Step 3: Fetch Doubts for Player
Use React Query to fetch doubts for the selected recording, transforming them to include user names and any answers.

### Step 4: Connect Card Click Handlers
Modify the card click handler to:
1. Set the selected recording
2. Open the fullscreen player
3. Log the activity (existing behavior)

### Step 5: Implement Player Event Handlers
- **onLectureChange**: Switch to a different lecture within the player
- **onDoubtSubmit**: Submit a new question to the database
- **onClose**: Close the fullscreen player and return to the grid view

### Step 6: Render the FullScreenVideoPlayer
Add the `FullScreenVideoPlayer` component conditionally when a lecture is selected for fullscreen viewing.

---

## Technical Details

### File Modified
- `src/components/student/StudentRecordings.tsx`

### New Imports
```typescript
import { FullScreenVideoPlayer } from '@/components/video-player';
import { Lecture, Doubt as PlayerDoubt } from '@/components/video-player/types';
```

### State Additions
```typescript
const [isPlayerOpen, setIsPlayerOpen] = useState(false);
const [playerLecture, setPlayerLecture] = useState<Lecture | null>(null);
```

### Data Transformation
```typescript
// Convert database recording to player lecture format
const recordingToLecture = (rec: RecordingContent, index: number): Lecture => ({
  id: rec.id,
  title: rec.topic,
  subject: rec.subject,
  videoUrl: rec.embed_link,
  isCompleted: false,
});

// Convert all recordings to lectures array
const allLectures = recordings?.map(recordingToLecture) || [];
```

### Doubts Integration
The existing doubts query and answers query will be transformed to match the `PlayerDoubt` interface:
```typescript
interface PlayerDoubt {
  id: string;
  question: string;
  askedBy: string;
  askedAt: Date;
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
}
```

### Card Click Handler Update
```typescript
const handlePlayInFullscreen = (recording: RecordingContent, index: number) => {
  const lecture = recordingToLecture(recording, index);
  setPlayerLecture(lecture);
  setSelectedRecording(recording);
  setIsPlayerOpen(true);
  logActivity('recording_view', `Opened fullscreen: ${recording.topic}`, {...});
};
```

### Doubt Submission Handler
```typescript
const handleDoubtSubmit = async (question: string) => {
  if (!user || !selectedRecording) return;
  await supabase.from('doubts').insert({
    recording_id: selectedRecording.id,
    user_id: user.id,
    question_text: question,
    batch: batch,
    subject: subject
  });
  // Invalidate doubts query to refresh
};
```

### Conditional Rendering
```tsx
{isPlayerOpen && playerLecture && (
  <FullScreenVideoPlayer
    currentLecture={playerLecture}
    lectures={allLectures}
    doubts={transformedDoubts}
    onLectureChange={(lecture) => {
      setPlayerLecture(lecture);
      const rec = recordings?.find(r => r.id === lecture.id);
      if (rec) setSelectedRecording(rec);
    }}
    onDoubtSubmit={handleDoubtSubmit}
    onClose={() => setIsPlayerOpen(false)}
    userName={profile?.name || user?.email}
  />
)}
```

## Diagram: User Flow

```text
+------------------+     Click Card     +----------------------+
|                  | -----------------> |                      |
|  Lecture Grid    |                    |  FullScreen Player   |
|  (Recording      |                    |  - Custom controls   |
|   Cards)         | <----------------- |  - Doubts sidebar    |
|                  |     Press ESC      |  - Lectures sidebar  |
+------------------+     or X button    +----------------------+
                                              |
                                              | Click other lecture
                                              v
                                        +----------------------+
                                        |  Same Player, New    |
                                        |  Video (no reload)   |
                                        +----------------------+
```

## Edge Cases Handled
- Empty recordings list - player won't open
- Missing embed_link - player still opens but video won't play
- Doubts loading state - shows "No questions yet" until loaded
- Real-time doubt updates - existing Supabase channel subscription continues to work
