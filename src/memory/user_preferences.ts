/**
 * user_preferences.ts — User preferences storage
 * 
 * Stores user preferences like name, favorite apps, settings, etc.
 * Persists to logs/user_preferences.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface UserPreferences {
  userName?: string;
  favoriteApps?: string[];
  defaultBrowser?: string;
  defaultEditor?: string;
  language?: string;
  theme?: string;
  [key: string]: unknown; // Allow arbitrary preferences
}

const DEFAULT_PREFERENCES: UserPreferences = {
  userName: 'Usuario',
  favoriteApps: [],
  language: 'es-AR',
};

const PREFERENCES_FILE = resolve(process.cwd(), 'logs/user_preferences.json');

/**
 * Load user preferences from file
 */
export async function loadPreferences(): Promise<UserPreferences> {
  try {
    if (!existsSync(PREFERENCES_FILE)) {
      console.log('[Preferences] No preferences file found, using defaults');
      return { ...DEFAULT_PREFERENCES };
    }

    const content = await readFile(PREFERENCES_FILE, 'utf-8');
    const prefs = JSON.parse(content) as UserPreferences;
    
    console.log(`[Preferences] Loaded preferences: ${Object.keys(prefs).length} keys`);
    
    return { ...DEFAULT_PREFERENCES, ...prefs };
  } catch (error) {
    console.error('[Preferences] Error loading preferences:', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Save user preferences to file
 */
export async function savePreferences(prefs: UserPreferences): Promise<void> {
  try {
    // Ensure logs directory exists
    const dir = dirname(PREFERENCES_FILE);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const content = JSON.stringify(prefs, null, 2);
    await writeFile(PREFERENCES_FILE, content, 'utf-8');
    
    console.log(`[Preferences] Saved preferences: ${Object.keys(prefs).length} keys`);
  } catch (error) {
    console.error('[Preferences] Error saving preferences:', error);
    throw error;
  }
}

/**
 * Update a single preference
 */
export async function updatePreference(key: string, value: unknown): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  prefs[key] = value;
  await savePreferences(prefs);
  return prefs;
}

/**
 * Get a single preference value
 */
export async function getPreference(key: string): Promise<unknown> {
  const prefs = await loadPreferences();
  return prefs[key];
}
