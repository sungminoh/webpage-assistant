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

    static async update(data, storageArea = 'local') {
      const obj = await this.get(Object.keys(data), storageArea);

      function mergeObjects(target, source) {
        if (!target || typeof target !== 'object') return source;
        if (!source || typeof source !== 'object') return target;

        let merged = Array.isArray(target) ? [...target] : { ...target };

        for (let key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            merged[key] = mergeObjects(target[key] || {}, source[key]);
          } else {
            merged[key] = source[key];
          }
        }
        return merged;
      }

      const mergedData = mergeObjects(obj, data)
      return new Promise((resolve) => {
        chrome.storage[storageArea].set(mergedData, resolve);
      });
    }
  
    static async remove(keys, storageArea = 'local') {
      return new Promise((resolve) => {
        chrome.storage[storageArea].remove(keys, resolve);
      });
    }
  }