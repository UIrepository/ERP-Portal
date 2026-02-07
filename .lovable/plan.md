
# Fix Plan: Video Player Seek Issues and Mobile Fullscreen Button

## Overview
This plan fixes two issues with the video player:
1. The seek bar not updating properly when clicked (related to progress tracking interference)
2. Removing the fullscreen icon control on mobile devices

## Problems Identified

### Issue 1: Seek Not Updating Properly
The problem occurs because:
- When a user clicks on the seek bar to jump to a new position, the `useVideoProgress` hook's auto-save logic and the YouTube interval time update can interfere
- The `lastSavedProgress` ref comparison causes issues when seeking back and forth quickly
- For YouTube, the 250ms interval updates `currentTime` which can momentarily overwrite the seeked position before YouTube finishes seeking

### Issue 2: Fullscreen Button on Mobile
- The fullscreen toggle is currently visible on all devices
- On mobile, it should be hidden since the player is already "fullscreen" (covers the entire viewport)

---

## Implementation Steps

### Step 1: Fix Seek in `useVideoPlayer.ts`
Update the `seek` function to:
- Immediately set `currentTime` state after calling `seekTo` on YouTube
- Add a flag to temporarily pause time update interval during seek operation

```typescript
// Add a seekingRef to track when we're actively seeking
const seekingRef = useRef(false);

const seek = useCallback((time: number) => {
  seekingRef.current = true;
  
  if (videoRef.current) {
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  } else if (youtubePlayerRef.current) {
    youtubePlayerRef.current.seekTo(time, true);
    setCurrentTime(time);
  }
  
  // Reset seeking flag after a brief delay
  setTimeout(() => {
    seekingRef.current = false;
  }, 500);
}, []);
```

### Step 2: Update `FullScreenVideoPlayer.tsx` YouTube Time Update
Modify the interval that updates current time to respect the seeking flag:

```typescript
const timeUpdateInterval = setInterval(() => {
  // Skip update if currently seeking (prevents overwriting user's seek position)
  if (seekingRef) return;
  
  if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
    // ... existing code
  }
}, 250);
```

The issue is `seekingRef` is inside `useVideoPlayer`, so we need to expose it or handle this differently.

### Step 3: Better Approach - Handle in FullScreenVideoPlayer
Instead of modifying the hook's internals extensively, we can:
1. Pass a callback for seek that also manages the time update pause
2. Or add a local seeking state in FullScreenVideoPlayer that skips time updates

### Step 4: Fix `useVideoProgress.ts` Save Logic
Update `saveProgress` to accept a `force` parameter that bypasses the 5-second check:

```typescript
const saveProgress = useCallback(async (currentTime: number, duration: number, force = false) => {
  if (!user?.id || !recordingId || duration <= 0) return;

  // Don't save if progress hasn't changed significantly, unless forced
  if (!force && Math.abs(currentTime - lastSavedProgress.current) < 5) return;
  // ... rest of save logic
}, [user?.id, recordingId]);
```

### Step 5: Add Mobile Detection to `VideoControls.tsx`
Import and use the `useIsMobile` hook:

```typescript
import { useIsMobile } from '@/hooks/use-mobile';

// Inside component:
const isMobile = useIsMobile();

// Conditionally render fullscreen button
{!isMobile && (
  <button onClick={onFullscreenToggle} ...>
    {isFullscreen ? <Minimize /> : <Maximize />}
  </button>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/video-player/useVideoPlayer.ts` | Add `seekingRef` and expose it; update seek function to set the flag |
| `src/components/video-player/FullScreenVideoPlayer.tsx` | Check `seekingRef` before updating time in the YouTube interval |
| `src/hooks/useVideoProgress.ts` | Add optional `force` parameter to `saveProgress` |
| `src/components/video-player/VideoControls.tsx` | Import `useIsMobile` and hide fullscreen button on mobile |

---

## Technical Details

### Modified `useVideoPlayer.ts`
```typescript
// Add ref
const seekingRef = useRef(false);

// Update seek function
const seek = useCallback((time: number) => {
  // Set seeking flag to prevent interval overwrites
  seekingRef.current = true;
  
  if (videoRef.current) {
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  } else if (youtubePlayerRef.current) {
    youtubePlayerRef.current.seekTo(time, true);
    setCurrentTime(time);
  }
  
  // Clear seeking flag after YouTube has time to update
  setTimeout(() => {
    seekingRef.current = false;
  }, 500);
}, []);

// Return seekingRef in the hook's return object
return {
  // ... existing returns
  seekingRef,
};
```

### Modified `FullScreenVideoPlayer.tsx` YouTube Interval
```typescript
const timeUpdateInterval = setInterval(() => {
  // Skip time updates while user is actively seeking
  if (seekingRef.current) return;
  
  if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
    const time = youtubePlayerRef.current.getCurrentTime();
    setCurrentTime(time);
    // ... rest
  }
}, 250);
```

### Modified `VideoControls.tsx`
```typescript
import { useIsMobile } from '@/hooks/use-mobile';

export const VideoControls = ({ ... }: VideoControlsProps) => {
  const isMobile = useIsMobile();
  // ... existing code

  return (
    <div ...>
      {/* Right Controls Group */}
      <div className="flex items-center gap-5">
        {/* ... other controls */}
        
        {/* Fullscreen Toggle - Hidden on mobile */}
        {!isMobile && (
          <button
            onClick={onFullscreenToggle}
            className="text-white/70 hover:text-white transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## Expected Outcome
- Clicking on the seek bar will immediately update the video position without being overwritten
- The progress bar UI will reflect the new position instantly
- Video progress will continue to be saved every 10 seconds
- On mobile devices (viewport width < 768px), the fullscreen button will be hidden
- All other controls remain functional on mobile

## Edge Cases Handled
- Rapid successive seeks work correctly (500ms debounce on seeking flag)
- YouTube buffering delays won't reset seek position
- Progress still saves correctly on close/switch lectures
- Mobile detection handles viewport resize events
