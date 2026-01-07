/**
 * FileSystemService - Browser File System Access API wrapper
 * Handles all low-level file operations for markdown persistence
 */

const DB_NAME = 'nez-tasks-fs';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'directoryHandle';

class FileSystemService {
  constructor() {
    this.directoryHandle = null;
    this.db = null;
  }

  /**
   * Initialize IndexedDB for storing directory handle
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  /**
   * Store directory handle in IndexedDB
   */
  async saveHandle() {
    if (!this.db || !this.directoryHandle) return;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(this.directoryHandle, HANDLE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Restore directory handle from IndexedDB
   * @returns {Promise<boolean>} True if handle was restored and permission granted
   */
  async restoreHandle() {
    if (!this.db) {
      await this.initDB();
    }
    
    return new Promise(async (resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      
      request.onerror = () => resolve(false);
      request.onsuccess = async () => {
        const handle = request.result;
        if (!handle) {
          resolve(false);
          return;
        }
        
        try {
          // Request permission - user may need to grant it again
          const permission = await handle.requestPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            this.directoryHandle = handle;
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (err) {
          console.log('Could not restore directory handle:', err);
          resolve(false);
        }
      };
    });
  }

  /**
   * Clear stored handle (for switching folders)
   */
  async clearHandle() {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(HANDLE_KEY);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Check if File System Access API is supported
   */
  isSupported() {
    return "showDirectoryPicker" in window;
  }

  /**
   * Prompt user to select a directory
   * @returns {Promise<boolean>} Success status
   */
  async requestDirectory() {
    try {
      this.directoryHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      
      // Store handle for persistence
      if (!this.db) {
        await this.initDB();
      }
      await this.saveHandle();
      
      return true;
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Failed to get directory access:", err);
      }
      return false;
    }
  }

  /**
   * Get directory name
   * @returns {string|null}
   */
  getDirectoryName() {
    return this.directoryHandle?.name || null;
  }

  /**
   * Check if we have an active directory
   * @returns {boolean}
   */
  hasDirectory() {
    return this.directoryHandle !== null;
  }

  /**
   * Get or create a subdirectory
   * @param {string} name - Subdirectory name
   * @returns {Promise<FileSystemDirectoryHandle>}
   */
  async getOrCreateSubdirectory(name) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }
    return await this.directoryHandle.getDirectoryHandle(name, {
      create: true,
    });
  }

  /**
   * List all files in a subdirectory matching a pattern
   * @param {string} subdir - Subdirectory name
   * @param {string} extension - File extension to filter (e.g., '.md')
   * @returns {Promise<string[]>} Array of filenames
   */
  async listFiles(subdir, extension = ".md") {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    const files = [];
    try {
      const subdirHandle = await this.directoryHandle.getDirectoryHandle(
        subdir,
        { create: false }
      );
      for await (const entry of subdirHandle.values()) {
        if (entry.kind === "file" && entry.name.endsWith(extension)) {
          files.push(entry.name);
        }
      }
    } catch (err) {
      // Directory doesn't exist yet, return empty
      if (err.name === "NotFoundError") {
        return [];
      }
      throw err;
    }
    return files;
  }

  /**
   * Read a file from a subdirectory
   * @param {string} subdir - Subdirectory name
   * @param {string} filename - File name
   * @returns {Promise<string>} File contents
   */
  async readFile(subdir, filename) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    const subdirHandle = await this.directoryHandle.getDirectoryHandle(subdir, {
      create: false,
    });
    const fileHandle = await subdirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * Read a file from the root directory
   * @param {string} filename - File name
   * @returns {Promise<string|null>} File contents or null if not found
   */
  async readRootFile(filename) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (err) {
      if (err.name === "NotFoundError") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Write a file to a subdirectory
   * @param {string} subdir - Subdirectory name
   * @param {string} filename - File name
   * @param {string} content - File contents
   */
  async writeFile(subdir, filename, content) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    const subdirHandle = await this.getOrCreateSubdirectory(subdir);
    const fileHandle = await subdirHandle.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Write a file to the root directory
   * @param {string} filename - File name
   * @param {string} content - File contents
   */
  async writeRootFile(filename, content) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    const fileHandle = await this.directoryHandle.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Delete a file from a subdirectory
   * @param {string} subdir - Subdirectory name
   * @param {string} filename - File name
   */
  async deleteFile(subdir, filename) {
    if (!this.directoryHandle) {
      throw new Error("No directory selected");
    }

    try {
      const subdirHandle = await this.directoryHandle.getDirectoryHandle(
        subdir,
        { create: false }
      );
      await subdirHandle.removeEntry(filename);
    } catch (err) {
      if (err.name !== "NotFoundError") {
        throw err;
      }
    }
  }

  /**
   * Rename/move a file within a subdirectory
   * @param {string} subdir - Subdirectory name
   * @param {string} oldFilename - Current file name
   * @param {string} newFilename - New file name
   * @param {string} content - File contents to write
   */
  async renameFile(subdir, oldFilename, newFilename, content) {
    await this.writeFile(subdir, newFilename, content);
    if (oldFilename !== newFilename) {
      await this.deleteFile(subdir, oldFilename);
    }
  }
}

// Export singleton instance
const fileSystemService = new FileSystemService();
export default fileSystemService;
