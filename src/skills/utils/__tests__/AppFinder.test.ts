/**
 * AppFinder.test.ts — Tests for system-wide app search
 */

import { describe, it, expect } from 'vitest';
import { findAndLaunchApp } from '../AppFinder.js';

describe('AppFinder', () => {
  describe('findAndLaunchApp', () => {
    it('should return structured result object', async () => {
      const result = await findAndLaunchApp('nonexistent-app-xyz-123');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    }, 10000); // Extended timeout to 10s for system search

    it('should reject empty app name', async () => {
      const result = await findAndLaunchApp('');
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/empty|vacío/i);
    });

    it('should reject whitespace-only app name', async () => {
      const result = await findAndLaunchApp('   ');
      
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/empty|vacío/i);
    });

    it('should return failure for nonsense app name', async () => {
      const result = await findAndLaunchApp('xyz-nonexistent-app-12345');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No encontré');
    }, 10000); // Extended timeout to 10s for system search

    // Note: We cannot reliably test actual app launching in CI/CD
    // because it depends on the host system's installed applications.
    // The following test is commented out but can be run manually on Windows:
    
    // it('should find and launch notepad on Windows', async () => {
    //   if (process.platform !== 'win32') {
    //     return; // Skip on non-Windows
    //   }
    //   
    //   const result = await findAndLaunchApp('notepad');
    //   
    //   expect(result.success).toBe(true);
    //   expect(result.message).toContain('opened successfully');
    // }, 10000);
  });
});
