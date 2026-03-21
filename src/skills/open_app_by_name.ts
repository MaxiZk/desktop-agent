import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { findAndLaunchApp } from './utils/AppFinder.js';

export interface OpenAppResult {
  success: boolean;
  message: string;
  appName?: string;
  error?: string;
}

interface AppConfig {
  type: 'path' | 'command' | 'url';
  value: string;
  aliases: string[];
}

interface AppsConfig {
  apps: Record<string, AppConfig>;
}

// Cache for loaded config
let cachedConfig: AppsConfig | null = null;

/**
 * Load app configuration from config/apps.json
 */
function loadAppConfig(): AppsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = resolve(process.cwd(), 'config/apps.json');
    const configData = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(configData);
    console.log(`[App Opener] Loaded ${Object.keys(cachedConfig!.apps).length} app configurations`);
    return cachedConfig!;
  } catch (error) {
    console.error('[App Opener] Failed to load config/apps.json:', error);
    // Return empty config as fallback
    return { apps: {} };
  }
}

/**
 * Find app configuration by name or alias
 */
function findAppConfig(appName: string): { key: string; config: AppConfig } | null {
  const config = loadAppConfig();
  const normalizedName = appName.toLowerCase().trim();

  // First, try exact match with app key
  for (const [key, appConfig] of Object.entries(config.apps)) {
    if (key.toLowerCase() === normalizedName) {
      return { key, config: appConfig };
    }
  }

  // Then, try matching aliases
  for (const [key, appConfig] of Object.entries(config.apps)) {
    if (appConfig.aliases.some(alias => alias.toLowerCase() === normalizedName)) {
      return { key, config: appConfig };
    }
  }

  return null;
}

/**
 * Get list of available apps
 */
export function getAvailableApps(): string[] {
  const config = loadAppConfig();
  return Object.keys(config.apps);
}

/**
 * Get detailed information about all configured apps
 */
export function getAppDetails(): Array<{ name: string; type: string; aliases: string[] }> {
  const config = loadAppConfig();
  return Object.entries(config.apps).map(([name, appConfig]) => ({
    name,
    type: appConfig.type,
    aliases: appConfig.aliases
  }));
}

/**
 * Open an application by name using the app configuration
 * 
 * @param appName - Name of the application to open
 * @returns OpenAppResult with success status
 */
export async function openAppByName(appName: string): Promise<OpenAppResult> {
  try {
    // Validate input
    if (!appName || appName.trim() === '') {
      return {
        success: false,
        message: 'App name is required',
        error: 'App name is required'
      };
    }

    // Find app configuration
    const appMatch = findAppConfig(appName);

    if (!appMatch) {
      // Fallback: try system-wide search
      console.log(`[App Opener] App not found in config, trying system-wide search for: ${appName}`);
      const systemResult = await findAndLaunchApp(appName);
      
      return {
        success: systemResult.success,
        message: systemResult.message,
        appName,
        error: systemResult.error
      };
    }

    const { key, config } = appMatch;

    console.log(`[App Opener] Matched app: ${key}`);
    console.log(`[App Opener] Launch type: ${config.type}`);
    console.log(`[App Opener] Launch value: ${config.value}`);

    // Execute based on type
    let command: string;

    switch (config.type) {
      case 'path':
        // Open executable at path
        command = `start "" "${config.value}"`;
        break;
      
      case 'command':
        // Execute Windows command directly
        command = config.value;
        break;
      
      case 'url':
        // Open URL in default browser
        command = `start "" "${config.value}"`;
        break;
      
      default:
        return {
          success: false,
          message: `Invalid app type: ${config.type}`,
          appName,
          error: 'Invalid app configuration'
        };
    }

    // Execute command
    await new Promise<void>((resolve, reject) => {
      exec(command, { windowsHide: true }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return {
      success: true,
      message: `${key} opened successfully`,
      appName: key
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to open ${appName}`,
        appName,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to open ${appName}`,
      appName,
      error: 'Unknown error occurred'
    };
  }
}
