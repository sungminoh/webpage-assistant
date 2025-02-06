// src/storageHelper.js
export class StorageHelper {
    static async get(keys, storageArea = 'local') {
      return new Promise((resolve) => {
        chrome.storage[storageArea].get(keys, resolve);
      });
    }
  
    static async set(data, storageArea = 'local') {
      return new Promise((resolve) => {
        chrome.storage[storageArea].set(data, resolve);
      });
    }
  
    static async remove(keys, storageArea = 'local') {
      return new Promise((resolve) => {
        chrome.storage[storageArea].remove(keys, resolve);
      });
    }
  }