import AsyncStorage from '@react-native-async-storage/async-storage';
import { customLog, customError } from './customLogger';

class StorageManager {
  constructor() {
    this.queue = Promise.resolve();
  }

  async getItem(key) {
    return this.enqueue(async () => {
      try {
        const value = await AsyncStorage.getItem(key);
        customLog(`Retrieved item: ${key}`);
        return value;
      } catch (error) {
        customError(`Error retrieving item: ${key}`, error);
        throw error;
      }
    });
  }

  async setItem(key, value) {
    return this.enqueue(async () => {
      try {
        await AsyncStorage.setItem(key, value);
        customLog(`Set item: ${key}`);
      } catch (error) {
        customError(`Error setting item: ${key}`, error);
        throw error;
      }
    });
  }

  async removeItem(key) {
    return this.enqueue(async () => {
      try {
        await AsyncStorage.removeItem(key);
        customLog(`Removed item: ${key}`);
      } catch (error) {
        customError(`Error removing item: ${key}`, error);
        throw error;
      }
    });
  }

  async getAllKeys() {
    return this.enqueue(async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        customLog('Retrieved all keys');
        return keys;
      } catch (error) {
        customError('Error retrieving all keys', error);
        throw error;
      }
    });
  }

  // Ensure operations are performed sequentially
  enqueue(operation) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Helper method to perform a transaction (multiple operations atomically)
  async transaction(operations) {
    return this.enqueue(async () => {
      try {
        const results = [];
        for (const operation of operations) {
          results.push(await operation());
        }
        return results;
      } catch (error) {
        customError('Transaction failed', error);
        throw error;
      }
    });
  }
}

export default new StorageManager();