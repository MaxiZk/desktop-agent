/**
 * Allowlist.ts — Manage approved apps and file paths
 * 
 * Provides allowlist management for bypassing security confirmations
 * for trusted applications and file paths.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

export interface AllowlistConfig {
  apps: string[];
  paths: string[];
}

export interface AllowlistResult {
  allowed: boolean;
  matchedEntry?: string;
}

export class Allowlist {
  private apps: Set<string>;
  private paths: string[];

  constructor(config?: AllowlistConfig) {
    this.apps = new Set((config?.apps ?? []).map(app => this.normalizeForMatch(app)));
    this.paths = (config?.paths ?? []).map(path => this.normalizeForMatch(path));
  }

  /**
   * Check if an app is in the allowlist
   */
  checkApp(appName: string): AllowlistResult {
    const normalized = this.normalizeForMatch(appName);
    
    if (this.apps.has(normalized)) {
      return {
        allowed: true,
        matchedEntry: appName,
      };
    }

    return { allowed: false };
  }

  /**
   * Check if a file path is in the allowlist
   */
  checkPath(filePath: string): AllowlistResult {
    const normalized = this.normalizeForMatch(filePath);

    for (const pattern of this.paths) {
      if (this.matchesPattern(normalized, pattern)) {
        return {
          allowed: true,
          matchedEntry: pattern,
        };
      }
    }

    return { allowed: false };
  }

  /**
   * Add entry to allowlist
   */
  add(type: 'app' | 'path', value: string): void {
    const normalized = this.normalizeForMatch(value);

    if (type === 'app') {
      this.apps.add(normalized);
    } else {
      // Prevent duplicates
      if (!this.paths.includes(normalized)) {
        this.paths.push(normalized);
      }
    }
  }

  /**
   * Remove entry from allowlist
   */
  remove(type: 'app' | 'path', value: string): void {
    const normalized = this.normalizeForMatch(value);

    if (type === 'app') {
      this.apps.delete(normalized);
    } else {
      this.paths = this.paths.filter(p => p !== normalized);
    }
  }

  /**
   * Load allowlist from JSON file
   */
  static async loadFromFile(path: string): Promise<Allowlist> {
    try {
      const absolutePath = resolve(path);
      const content = await readFile(absolutePath, 'utf-8');
      const config: AllowlistConfig = JSON.parse(content);
      
      return new Allowlist(config);
    } catch (error) {
      // File not found or invalid JSON - return empty allowlist
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.warn(`[Allowlist] File not found: ${path}, using empty allowlist`);
        return new Allowlist();
      }
      
      console.error(`[Allowlist] Failed to load from file: ${error}`);
      return new Allowlist();
    }
  }

  /**
   * Save allowlist to JSON file
   */
  async saveToFile(path: string): Promise<void> {
    try {
      const absolutePath = resolve(path);
      const config: AllowlistConfig = {
        apps: Array.from(this.apps),
        paths: this.paths,
      };
      
      const content = JSON.stringify(config, null, 2);
      await writeFile(absolutePath, content, 'utf-8');
    } catch (error) {
      console.error(`[Allowlist] Failed to save to file: ${error}`);
      throw error;
    }
  }

  /**
   * Normalize value for case-insensitive matching
   */
  private normalizeForMatch(value: string): string {
    return value.toLowerCase().trim();
  }

  /**
   * Check if a path matches a pattern with wildcards
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    // * matches any characters except path separators
    // ** would match across path separators (not implemented yet)
    
    const regexPattern = pattern
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/\./g, '\\.')   // Escape dots
      .replace(/\*/g, '[^/\\\\]*'); // * matches anything except path separators
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(path);
  }
}
