import { DOMParser } from 'react-native-html-parser';
import AsyncStorage from '@react-native-async-storage/async-storage';

const fiiesListurl = "http://atourcity.com/bkgoswami.com/wp/wp-content/uploads/allfiles.txt"

async function fetchFilesList(filesListUrl) {
  const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
  const response = await fetch(proxyUrl + filesListUrl);
  const txt = await response.text();

  // Split the text into lines and remove any empty lines
  const files = txt.split('\n').filter(file => file.trim() !== '');

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
  const files = await fetchFilesList(filesListUrl);
  await cacheFiles(files);
  return files;
}

async function getAllFiles() {
  const files = await loadCachedFiles();
  return files;
}

async function getRandomFile() {
  const files = await getAllFiles();
  const randomIndex = Math.floor(Math.random() * files.length);
  return files[randomIndex];
}

export { getAllFiles, getRandomFile };
