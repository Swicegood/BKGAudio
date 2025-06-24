import StorageManager from './StorageManager';
import { customLog, customError } from './customLogger';

const filesListUrl = "https://atourcity.com/bkgoswami.com/wp/wp-content/uploads/all_files.txt";

// Add lock to prevent concurrent getNextFile calls
let getNextFileLock = false;

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

async function getPlayedFiles() {
  try {
    const rawData = await StorageManager.getItem('playedFiles');
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    customError('Error getting played files:', error);
    throw error;
  }
}

async function setPlayedFile(file, index) {
  try {
    const playedFiles = await getPlayedFiles();

    if (typeof index === "number") {
      playedFiles[index] = file;
    } else {
      playedFiles.push(file);
    }

    await StorageManager.setItem('playedFiles', JSON.stringify(playedFiles));
  } catch (error) {
    customError('Error setting played file:', error);
    throw error;
  }
}

async function getCurrentIndex() {
  try {
    const rawData = await StorageManager.getItem('currentIndex');
    return rawData ? JSON.parse(rawData) : 0;
  } catch (error) {
    customError('Error getting current index:', error);
    throw error;
  }
}

async function setCurrentIndex(index) {
  try {
    await StorageManager.setItem('currentIndex', JSON.stringify(index));
  } catch (error) {
    customError('Error setting current index:', error);
    throw error;
  }
}

async function getRandomFile() {
  try {
    const files = await getAllFiles();
    const playedFiles = await getPlayedFiles();

    const unplayedFiles = files.filter(file => !playedFiles.includes(file));

    if (unplayedFiles.length === 0) {
      await StorageManager.removeItem('playedFiles');
      return getRandomFile();
    }
    
    const randomIndex = Math.floor(Math.random() * unplayedFiles.length);
    const randomFile = unplayedFiles[randomIndex];
    const currentIndex = playedFiles.length;

    customLog('Random file:', randomFile);
    
    try {
      await setPlayedFile(randomFile, currentIndex);
      await setCurrentIndex(currentIndex);
    } catch (error) {
      customError('Error updating storage:', error);
      // If storage update fails, still return the random file
    }

    return randomFile;
  } catch (error) {
    customError('Error in getRandomFile:', error);
    // If all else fails, return a hardcoded file URL as a fallback
    // return "https://atourcity.com/bkgoswami.com/wp/wp-content/uploads/fallback-audio.mp3";
  }
}

async function getPreviousFile() {
  try {
    const currentIndex = await getCurrentIndex();

    if (currentIndex <= 0) {
      return null;
    }

    const newIndex = currentIndex - 1;
    await setCurrentIndex(newIndex);
    const playedFiles = await getPlayedFiles();
    return playedFiles[newIndex];
  } catch (error) {
    customError('Error in getPreviousFile:', error);
    throw error;
  }
}

async function getNextFile() {
  // Prevent concurrent calls that can corrupt the index
  if (getNextFileLock) {
    customLog('getNextFile already in progress, waiting...');
    // Wait for current operation to complete
    while (getNextFileLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    // If we waited, we might not need to do anything
    return getNextFile();
  }

  try {
    getNextFileLock = true;
    customLog('Starting getNextFile operation');
    
    const playedFiles = await getPlayedFiles();
    const currentIndex = await getCurrentIndex();
    const allFiles = await getAllFiles();

    customLog('Current index:', currentIndex, 'Total files:', allFiles.length);

    if (currentIndex === allFiles.length - 1) {
      customLog('Reached end of list, getting random file');
      return getRandomFile();
    }

    const newIndex = currentIndex + 1;
    let nextFile;

    if (playedFiles[newIndex]) {
      nextFile = playedFiles[newIndex];
      customLog('Using cached played file at index:', newIndex);
    } else {
      nextFile = allFiles[newIndex];
      await setPlayedFile(nextFile, newIndex);
      customLog('Added new file to played list at index:', newIndex);
    }

    await setCurrentIndex(newIndex);
    customLog('Updated current index to:', newIndex);
    return nextFile;
  } catch (error) {
    customError('Error in getNextFile:', error);
    throw error;
  } finally {
    getNextFileLock = false;
  }
}

export { getAllFiles, getRandomFile, getPreviousFile, getNextFile };