import StorageManager from './StorageManager';
import { customLog, customError } from './customLogger';

const filesListUrl = "https://atourcity.com/bkgoswami.com/wp/wp-content/uploads/all_files.txt";

async function fetchFilesList(filesListUrl) {
  try {
    const response = await fetch(filesListUrl);
    const txt = await response.text();
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
    
    await StorageManager.transaction([
      () => setPlayedFile(randomFile, currentIndex),
      () => setCurrentIndex(currentIndex)
    ]);

    return randomFile;
  } catch (error) {
    customError('Error in getRandomFile:', error);
    throw error;
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
  try {
    const playedFiles = await getPlayedFiles();
    const currentIndex = await getCurrentIndex();
    const allFiles = await getAllFiles();

    if (currentIndex === allFiles.length - 1) {
      return getRandomFile();
    }

    const newIndex = currentIndex + 1;
    let nextFile;

    if (playedFiles[newIndex]) {
      nextFile = playedFiles[newIndex];
    } else {
      nextFile = allFiles[newIndex];
      await setPlayedFile(nextFile, newIndex);
    }

    await setCurrentIndex(newIndex);
    return nextFile;
  } catch (error) {
    customError('Error in getNextFile:', error);
    throw error;
  }
}

export { getAllFiles, getRandomFile, getPreviousFile, getNextFile };