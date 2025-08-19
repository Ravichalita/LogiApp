// This file mimics a simple JSON-based database.
// In a real-world application, you would use a proper database like Firestore,
// PostgreSQL, or MySQL.
import fs from 'fs/promises';
import path from 'path';

// Note: process.cwd() in Next.js might be different in development vs. production.
// This setup is for demonstration purposes. In a real app, ensure the path
// resolves correctly in your deployment environment.
const dataDir = path.join(process.cwd(), 'data');

/**
 * A simple database utility for reading from and writing to JSON files.
 * This helps ensure that data modifications are "atomic" by reading
 * the latest data, applying a change, and writing it back.
 */
export const db = {
  /**
   * Reads data from a JSON file.
   * @param key The name of the data file (without .json extension).
   * @returns The parsed JSON data.
   */
  async read<T = any>(key: string): Promise<T> {
    try {
      const filePath = path.join(dataDir, `${key}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading from db "${key}":`, error);
      // Depending on the use case, you might want to return an empty array
      // or throw the error. For this app, an empty array is safer.
      return [] as T;
    }
  },

  /**
   * Writes data to a JSON file by applying an update function.
   * @param key The name of the data file (without .json extension).
   * @param updater A function that receives the current data and returns the new data.
   */
  async write<T = any>(key: string, updater: (currentData: T) => T): Promise<void> {
    try {
      const filePath = path.join(dataDir, `${key}.json`);
      // Ensure the directory exists
      await fs.mkdir(dataDir, { recursive: true });

      let currentData: T;
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        currentData = JSON.parse(fileContent);
      } catch (readError) {
        // If the file doesn't exist, start with an empty array.
        currentData = [] as T;
      }
      
      const newData = updater(currentData);
      await fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error writing to db "${key}":`, error);
      throw new Error(`Failed to write to database for key: ${key}`);
    }
  },
};
