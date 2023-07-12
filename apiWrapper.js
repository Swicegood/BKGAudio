
import AsyncStorage from '@react-native-async-storage/async-storage';

const fiiesListurl = "http://atourcity.com/bkgoswami.com/wp/wp-content/uploads/all_files.txt"

async function fetchFilesList(filesListUrl) {
  const proxyUrl = '';
  const response = await fetch(proxyUrl + filesListUrl);
  const txt = await response.text();

  // Split the text into lines and remove any empty lines or lines starting with '#'
  const files = txt.split('\n').filter(file => file.trim() !== '' && !file.trim().startsWith('#'));


  return files;
}


async function cacheFiles(files) {
  const expiration = files.length < 500
    ? Date.now() - 1 // Set the cache as already expired
    : Date.now() + 7 * 24 * 60 * 60 * 1000; // One week in the future

  const data = {
    files,
    expiration,
  };

  await AsyncStorage.setItem('mp3Files', JSON.stringify(data));
}

async function loadCachedFiles() {
  const rawData = await AsyncStorage.getItem('mp3Files');

  if (rawData) {
    const data = JSON.parse(rawData);
    if (Date.now() < data.expiration) {
      return data.files;
    }
  }

  // Fetch the list of files and cache them
  const files = await fetchFilesList(fiiesListurl);
  await cacheFiles(files);
  return files;
}

async function getAllFiles() {
  try
  {
  const files = await loadCachedFiles();
  return files;
  } catch (error) {
    console.error('Error in  getAllFiles:', error);
  }
}

async function getPlayedFiles() {
  const rawData = await AsyncStorage.getItem('playedFiles');
  return rawData ? JSON.parse(rawData) : [];
}

// ... Other code ...

async function setPlayedFile(file, index) {
  const playedFiles = await getPlayedFiles();

  if (typeof index === "number") {
    playedFiles[index] = file;
  } else {
    playedFiles.push(file);
  }

  await AsyncStorage.setItem('playedFiles', JSON.stringify(playedFiles));
}

async function getCurrentIndex() {
  const rawData = await AsyncStorage.getItem('currentIndex');
  return rawData ? JSON.parse(rawData) : 0;
}

async function setCurrentIndex(index) {
  await AsyncStorage.setItem('currentIndex', JSON.stringify(index));
}

async function getRandomFile() {
  try{
  const files = await getAllFiles();
  const playedFiles = await getPlayedFiles();

  // Filter out the played files
  const unplayedFiles = files.filter(file => !playedFiles.includes(file));

  if (unplayedFiles.length === 0) {
    // All files have been played, reset the played files list
    await AsyncStorage.removeItem('playedFiles');
    return getRandomFile(); // Retry with an empty played files list
  }
  
  const randomIndex = Math.floor(Math.random() * unplayedFiles.length);
  const randomFile = unplayedFiles[randomIndex];
  const currentIndex = playedFiles.length;
  await setPlayedFile(randomFile, currentIndex);
  await setCurrentIndex(currentIndex);
  return randomFile;
} catch (error) {
  console.error('Error in getRandomFile:', error);
}
}




async function getPreviousFile() {
  try
  {
  const currentIndex = await getCurrentIndex();

  if (currentIndex <= 0) {
    return 0; // There is no previous file
  }

  const newIndex = currentIndex - 1;
  await setCurrentIndex(newIndex);
  const playedFiles = await getPlayedFiles();
  console.log("Previous file :", playedFiles[newIndex])
  return playedFiles[newIndex];
} catch (error) {
  console.error('Error in getpreviousFile:', error);
}
}

async function getNextFile() {
  try{
  const playedFiles = await getPlayedFiles();
  const currentIndex = await getCurrentIndex();
  const allFiles = await getAllFiles();

  if (currentIndex === allFiles.length - 1) {
    // If there is no next file, return random
    return getRandomFile();
  }

  const newIndex = currentIndex + 1;
  if (playedFiles[newIndex]) {
    // If the next file has already been played
    await setCurrentIndex(newIndex);
    return playedFiles[newIndex];
  } else {
    // If the next file has not been played
    const nextFile = allFiles[newIndex];
    await setPlayedFile(nextFile, newIndex);
    await setCurrentIndex(newIndex);
    return nextFile;
  }
} catch (error) {
  console.error('Error in geteNextFile:', error);
}
}

export { getAllFiles, getRandomFile, getPreviousFile, getNextFile };
