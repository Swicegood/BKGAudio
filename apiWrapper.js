import StorageManager from './StorageManager';
import { customLog, customError } from './customLogger';

const filesListUrl = "https://atourcity.com/bkgoswami.com/wp/wp-content/uploads/all_files.txt";

// Add lock to prevent concurrent operations
let operationLock = false;

async function fetchFilesList(filesListUrl) {
  try {
    proxyUrl = '';
    const response = await fetch(proxyUrl + filesListUrl);
    const txt = await response.text();
    if (!txt) {
      throw new Error('Empty response');
    }
    customLog('Fetched files list');
    return txt.split('\n').filter(file => file.trim() !== '' && !file.trim().startsWith('#'));
  } catch (error) {
    customError('Error fetching files list:', error);
    throw error;
  }
}

async function cacheFiles(files) {
  try {
    const expiration = files.length < 500
      ? Date.now() - 1
      : Date.now() + 7 * 24 * 60 * 60 * 1000;

    const data = JSON.stringify({ files, expiration });
    await StorageManager.setItem('mp3Files', data);
  } catch (error) {
    customError('Error caching files:', error);
    throw error;
  }
}

async function loadCachedFiles() {
  try {
    const rawData = await StorageManager.getItem('mp3Files');
    
    if (rawData) {
      const data = JSON.parse(rawData);
      if (Date.now() < data.expiration) {
        return data.files;
      }
    }

    customLog('Cached files expired or not found');
    customLog('Fetching new files list');
    const files = await fetchFilesList(filesListUrl);
    await cacheFiles(files);
    return files;
  } catch (error) {
    customError('Error loading cached files:', error);
    throw error;
  }
}

async function getAllFiles() {
  try {
    return await loadCachedFiles();
  } catch (error) {
    customError('Error in getAllFiles:', error);
    throw error;
  }
}

// NEW HISTORY-BASED SYSTEM

async function getPlayedHistory() {
  try {
    const rawData = await StorageManager.getItem('playedHistory');
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    customError('Error getting played history:', error);
    return [];
  }
}

async function getCurrentHistoryIndex() {
  try {
    const rawData = await StorageManager.getItem('currentHistoryIndex');
    return rawData ? JSON.parse(rawData) : -1; // -1 means no history yet
  } catch (error) {
    customError('Error getting current history index:', error);
    return -1;
  }
}

async function setCurrentHistoryIndex(index) {
  try {
    await StorageManager.setItem('currentHistoryIndex', JSON.stringify(index));
    customLog('Set current history index to:', index);
  } catch (error) {
    customError('Error setting current history index:', error);
    throw error;
  }
}

async function addToHistory(track) {
  try {
    const history = await getPlayedHistory();
    history.push(track);
    await StorageManager.setItem('playedHistory', JSON.stringify(history));
    
    const newIndex = history.length - 1;
    await setCurrentHistoryIndex(newIndex);
    customLog('Added to history at index:', newIndex, 'Track:', track);
    return newIndex;
  } catch (error) {
    customError('Error adding to history:', error);
    throw error;
  }
}

async function getTrulyRandomTrack() {
  try {
    const allFiles = await getAllFiles();
    const history = await getPlayedHistory();
    
    // Avoid recently played tracks (last 10% of library or 50 tracks, whichever is smaller)
    const recentlyPlayedCount = Math.min(50, Math.floor(allFiles.length * 0.1));
    const recentTracks = history.slice(-recentlyPlayedCount);
    
    customLog('Total files:', allFiles.length, 'Recent tracks to avoid:', recentTracks.length);
    
    const availableTracks = allFiles.filter(track => !recentTracks.includes(track));
    const trackPool = availableTracks.length > 0 ? availableTracks : allFiles;
    
    customLog('Available tracks pool size:', trackPool.length);
    
    const randomIndex = Math.floor(Math.random() * trackPool.length);
    const selectedTrack = trackPool[randomIndex];
    
    customLog('Truly random track selected:', selectedTrack);
    return selectedTrack;
  } catch (error) {
    customError('Error getting truly random track:', error);
    throw error;
  }
}

// MIGRATION LOGIC FOR BACKWARD COMPATIBILITY

async function migrateToNewSystem() {
  try {
    // Check if migration has already been done
    const migrationComplete = await StorageManager.getItem('historyMigrationComplete');
    if (migrationComplete) {
      customLog('Migration already completed, skipping');
      return;
    }
    
    customLog('Starting migration to new history system');
    
    // Get old system data
    const oldPlayedFilesData = await StorageManager.getItem('playedFiles');
    const oldCurrentIndexData = await StorageManager.getItem('currentIndex');
    
    if (oldPlayedFilesData) {
      const oldPlayedFiles = JSON.parse(oldPlayedFilesData);
      const oldCurrentIndex = oldCurrentIndexData ? JSON.parse(oldCurrentIndexData) : 0;
      
      customLog('Migrating', oldPlayedFiles.length, 'tracks from old system');
      
      // Migrate to new system
      await StorageManager.setItem('playedHistory', JSON.stringify(oldPlayedFiles));
      await setCurrentHistoryIndex(oldCurrentIndex);
      
      customLog('Migration completed successfully');
    } else {
      customLog('No old data to migrate');
    }
    
    // Mark migration as complete
    await StorageManager.setItem('historyMigrationComplete', 'true');
    
  } catch (error) {
    customError('Error during migration:', error);
    // Don't throw - allow app to continue with fresh start if migration fails
  }
}

// UPDATED API FUNCTIONS

async function getNextFile() {
  // Prevent concurrent calls
  if (operationLock) {
    customLog('Operation already in progress, waiting...');
    let waitTime = 0;
    while (operationLock && waitTime < 5000) {
      await new Promise(resolve => setTimeout(resolve, 50));
      waitTime += 50;
    }
    if (operationLock) {
      customLog('Operation still locked, forcing unlock');
      operationLock = false;
    }
  }

  try {
    operationLock = true;
    customLog('Starting getNextFile operation');
    
    // Ensure migration is complete
    await migrateToNewSystem();
    
    const history = await getPlayedHistory();
    const currentIndex = await getCurrentHistoryIndex();
    
    customLog('Current history index:', currentIndex, 'History length:', history.length);
    
    // Check if we can move forward in existing history
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      await setCurrentHistoryIndex(newIndex);
      const nextTrack = history[newIndex];
      customLog('Moving forward in history to index:', newIndex, 'Track:', nextTrack);
      return nextTrack;
    }
    
    // We're at the leading edge - generate new random track
    customLog('At leading edge, generating new random track');
    const newTrack = await getTrulyRandomTrack();
    await addToHistory(newTrack);
    return newTrack;
    
  } catch (error) {
    customError('Error in getNextFile:', error);
    throw error;
  } finally {
    operationLock = false;
  }
}

async function getPreviousFile() {
  try {
    // Ensure migration is complete
    await migrateToNewSystem();
    
    const currentIndex = await getCurrentHistoryIndex();
    const history = await getPlayedHistory();
    
    customLog('DEBUG getPreviousFile: currentIndex:', currentIndex, 'historyLength:', history.length);
    
    if (currentIndex <= 0) {
      customLog('No previous track available - currentIndex <= 0');
      return null;
    }
    
    const newIndex = currentIndex - 1;
    customLog('DEBUG getPreviousFile: newIndex will be:', newIndex);
    
    await setCurrentHistoryIndex(newIndex);
    
    const previousTrack = history[newIndex];
    
    customLog('Moving back in history to index:', newIndex, 'Track:', previousTrack);
    return previousTrack;
    
  } catch (error) {
    customError('Error in getPreviousFile:', error);
    throw error;
  }
}

// Keep this for initial app load or manual random selection
async function getRandomFile() {
  try {
    // Ensure migration is complete
    await migrateToNewSystem();
    
    const newTrack = await getTrulyRandomTrack();
    await addToHistory(newTrack);
    return newTrack;
  } catch (error) {
    customError('Error in getRandomFile:', error);
    throw error;
  }
}

// LEGACY FUNCTIONS FOR BACKWARD COMPATIBILITY (deprecated but kept for safety)

async function getPlayedFiles() {
  customLog('Warning: getPlayedFiles() is deprecated, use getPlayedHistory() instead');
  return await getPlayedHistory();
}

async function getCurrentIndex() {
  customLog('Warning: getCurrentIndex() is deprecated, use getCurrentHistoryIndex() instead');
  return await getCurrentHistoryIndex();
}

export { 
  getAllFiles, 
  getRandomFile, 
  getPreviousFile, 
  getNextFile,
  // New functions
  getPlayedHistory,
  getCurrentHistoryIndex,
  getTrulyRandomTrack,
  migrateToNewSystem,
  // Legacy functions (deprecated)
  getPlayedFiles,
  getCurrentIndex
};