

# Fix: Video Player Gets Stuck at Network Error Points in YouTube Recordings

## Problem

When a YouTube live stream experienced network issues, the resulting recording has "dead spots." The YouTube player enters a perpetual BUFFERING state (state 3) at these points and never recovers. Manual seeking also fails because the `seek` function seeks to the exact dead spot region.

## Solution

Add a **stuck detection mechanism** in the YouTube time-update interval. If the player stays in BUFFERING state at the same position for more than a few seconds, automatically seek forward past the dead spot.

### File: `src/components/video-player/FullScreenVideoPlayer.tsx`

Add a stuck-detection ref and logic inside the existing `timeUpdateInterval`:

1. Track consecutive buffering ticks at the same position using a ref (`bufferingStuckRef`)
2. If buffering at the same time for ~3 seconds (12 ticks at 250ms), auto-seek forward by 2 seconds
3. On the `onStateChange` handler, if YouTube reports an error or stays buffering, attempt a recovery seek

**Changes to the `useEffect` for YouTube (lines 127-209):**

- Add a `bufferingStuckRef = useRef({ time: 0, count: 0 })` 
- Inside the interval, when state is BUFFERING (3):
  - Instead of just `return`, check if current time hasn't changed
  - If stuck for 12+ ticks (~3s), call `seek(currentStuckTime + 2)` to jump past the dead spot
  - Reset the counter after seeking
- In `onStateChange`, handle state `-1` (UNSTARTED) as potential stuck recovery

### File: `src/components/video-player/useVideoPlayer.tsx`

No changes needed — the existing `seek` function with `seekTo(time, true)` and the `seekingRef` flag already handle the mechanics correctly.

## Files Changed

| File | Change |
|------|--------|
| `src/components/video-player/FullScreenVideoPlayer.tsx` | Add buffering-stuck detection in YouTube interval; auto-seek past dead spots after ~3s of no progress |

