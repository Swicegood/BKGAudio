# Continuous Playback Fixes for BKGAudio

## Issues That Were Preventing Continuous Playback

Your app had several issues that prevented it from playing lectures continuously like Apple Books:

### 1. **Queue Management Problems**
- **Issue**: The app was using `TrackPlayer.reset()` and adding one track at a time, which interrupts the audio stream
- **Apple Books Approach**: Maintains a proper queue with multiple tracks pre-loaded
- **Fix**: Improved queue management in service.js with better track loading logic

### 2. **Conflicting Event Handlers**
- **Issue**: Both `useAudioPlayer.js` and `service.js` were handling the same events, creating race conditions
- **Fix**: Simplified event handling by letting service.js handle queue management exclusively

### 3. **Debouncing Delays**
- **Issue**: 1000ms debounce on `debouncedLoadNextFile` was causing delays between tracks
- **Fix**: Removed debouncing for immediate track advancement

### 4. **Background Playback Configuration Issues**
- **Issue**: `AppKilledPlaybackBehavior` was being toggled between foreground/background, interrupting playback
- **Fix**: Set consistent `ContinuePlayback` behavior

### 5. **Inadequate Auto-advance Logic**
- **Issue**: The auto-advance logic was not robust enough to handle edge cases
- **Fix**: Improved error handling and fallback mechanisms in `getNextFile()`

## Key Changes Made

### 1. **useAudioPlayer.js**
```javascript
// BEFORE: Complex event handling with debouncing
useTrackPlayerEvents([Event.PlaybackTrackChanged, Event.PlaybackState, Event.PlaybackError], async (event) => {
  // Complex logic with race conditions
  await debouncedLoadNextFile(); // 1000ms delay
});

// AFTER: Simplified event handling
useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
  // Let service.js handle queue management
  setIsPlaying(event.state === State.Playing);
});
```

### 2. **service.js**
```javascript
// BEFORE: Basic queue ended handling
TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
  // Simple logic that could fail
});

// AFTER: Robust auto-advance with error handling
TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
  await loadNextTrack(); // Robust function with fallbacks
});

// Added auto-advance prevention
let isAutoAdvancing = false; // Prevents duplicate loading
```

### 3. **App.tsx**
```javascript
// BEFORE: Problematic behavior toggling
const handleAppStateChange = async (nextAppState: string) => {
  if (appState.current.match(/active/) && nextAppState === 'background') {
    await TrackPlayer.updateOptions({
      android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification }
    });
  }
  // This was interrupting playback!
};

// AFTER: Consistent background behavior
await TrackPlayer.updateOptions({
  android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback }
  // Keep consistent - no toggling
});
```

### 4. **apiWrapper.js**
```javascript
// BEFORE: Basic error handling
async function getNextFile() {
  // Could fail and stop playback
  throw error;
}

// AFTER: Robust error handling with fallbacks
async function getNextFile() {
  try {
    // Main logic
  } catch (error) {
    // Fallback to random file to keep playback going
    return await getRandomFile();
  }
}
```

## Why Apple Books Works Seamlessly

1. **Pre-loading**: Apple Books pre-loads multiple chapters/tracks in the queue
2. **Consistent Queue**: Maintains a proper audio queue without frequent resets
3. **Robust Error Handling**: Has multiple fallback mechanisms
4. **Proper Audio Session Management**: Uses iOS/Android audio focus APIs correctly
5. **Background Processing**: Optimized for background audio processing

## Testing Your Fixes

To verify continuous playbook works:

1. **Play a lecture and let it finish completely**
   - Should automatically advance to the next lecture
   - No interruption or delay between tracks

2. **Test background playback**
   - Start playback and put app in background
   - Should continue playing for hours without interruption

3. **Test device sleep**
   - Let device go to sleep during playback
   - Should continue playing and advance tracks

4. **Test interruptions**
   - Take a phone call during playback
   - Should resume after call ends

5. **Test long sessions**
   - Let it play for 1+ hours continuously
   - Should advance through multiple lectures seamlessly

## Additional Recommendations

### 1. **Consider Implementing a Proper Queue**
For even better performance like Apple Books:
```javascript
// Pre-load next 2-3 tracks in queue
const loadQueue = async () => {
  const nextFiles = await getNext3Files();
  await TrackPlayer.add(nextFiles);
};
```

### 2. **Add Proper Audio Focus Management**
```bash
npm install react-native-audio-focus
```

### 3. **Implement Smarter Pre-loading**
```javascript
// Pre-load next track when current track is 80% complete
if (position / duration > 0.8) {
  preloadNextTrack();
}
```

### 4. **Add Network Recovery**
```javascript
// Handle network interruptions gracefully
const retryPlayback = async (retries = 3) => {
  // Retry logic for network issues
};
```

## Expected Behavior Now

After these fixes, your app should:
- ✅ Play lectures continuously without gaps
- ✅ Auto-advance to next lecture when one finishes
- ✅ Continue playing in background for hours
- ✅ Survive app state changes and device sleep
- ✅ Handle errors gracefully without stopping playback
- ✅ Resume properly after interruptions

Your app should now behave very similarly to Apple Books in terms of continuous audio playback!