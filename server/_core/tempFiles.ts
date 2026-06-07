/**
 * Utility functions for handling temporary files
 * Used to avoid ENAMETOOLONG errors when passing large data URLs to Python processes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for temporary files
const TEMP_DIR = path.join(__dirname, '../temp');
const MAX_URL_LENGTH = 2000; // Windows command line limit is ~8191, but we use JSON which adds overhead

/**
 * Ensures temp directory exists
 */
async function ensureTempDir(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, which is fine
  }
}

/**
 * Downloads a file from URL or saves data URL to a temporary file
 * Returns the path to the temporary file
 */
export async function saveToTempFile(
  urlOrData: string,
  extension: string = 'tmp'
): Promise<string> {
  await ensureTempDir();
  
  const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);
  
  try {
    if (urlOrData.startsWith('data:')) {
      // Data URL: data:application/pdf;base64,...
      const base64Data = urlOrData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(tempFilePath, buffer);
    } else if (urlOrData.startsWith('http://') || urlOrData.startsWith('https://')) {
      // HTTP URL
      const response = await fetch(urlOrData);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(tempFilePath, buffer);
    } else {
      // Assume it's a file path
      return urlOrData;
    }
    
    return tempFilePath;
  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Checks if a URL/data URL should be saved to temp file
 */
export function shouldUseTempFile(url: string): boolean {
  // Use temp file if it's a data URL or URL is too long
  return url.startsWith('data:') || url.length > MAX_URL_LENGTH;
}

/**
 * Cleans up a temporary file
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    // Only delete files in temp directory for safety
    if (filePath.startsWith(TEMP_DIR)) {
      // Check if file exists before trying to delete
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (error: any) {
        // File doesn't exist or already deleted - that's fine
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  } catch (error) {
    // Ignore errors when cleaning up - just log as debug
    // Don't show warnings for files that don't exist
  }
}

/**
 * Processes a URL/data URL and returns either the original or a temp file path
 * Returns an object with the path and a cleanup function
 */
export async function processFileForPython(
  urlOrData: string,
  extension: string = 'tmp'
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  if (shouldUseTempFile(urlOrData)) {
    const tempPath = await saveToTempFile(urlOrData, extension);
    return {
      path: tempPath,
      cleanup: () => cleanupTempFile(tempPath),
    };
  }
  
  // Return original URL/path with no-op cleanup
  return {
    path: urlOrData,
    cleanup: async () => {},
  };
}

/**
 * Cleans up old temporary files (older than 1 hour)
 */
export async function cleanupOldTempFiles(): Promise<void> {
  try {
    await ensureTempDir();
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    for (const file of files) {
      if (file.startsWith('temp_')) {
        const filePath = path.join(TEMP_DIR, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtimeMs > oneHour) {
            await fs.unlink(filePath);
          }
        } catch {
          // Ignore errors for individual files
        }
      }
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Failed to cleanup old temp files:', error);
  }
}

// Cleanup old files on startup
cleanupOldTempFiles().catch(() => {});

