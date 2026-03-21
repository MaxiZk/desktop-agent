/**
 * Unit tests for Windows App Launcher module
 * 
 * Tests the openCalculator and openNotepad functions
 */

import { describe, it, expect } from 'vitest';
import { openCalculator, openNotepad } from '../open_windows_app';

describe('Windows App Launcher', () => {
  describe('openCalculator', () => {
    it('should return a CommandResult object', async () => {
      const result = await openCalculator();
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    }, 10000); // Extended timeout to 10s for system operations

    it('should attempt to open Calculator', async () => {
      const result = await openCalculator();
      
      // On Windows, this should succeed
      // On other platforms, it may fail, but should still return a valid result
      if (result.success) {
        expect(result.message).toMatch(/calculadora|calculator/i);
      } else {
        expect(result.error).toBeDefined();
      }
    }, 10000); // Extended timeout to 10s for system operations
  });

  describe('openNotepad', () => {
    it('should return a CommandResult object', async () => {
      const result = await openNotepad();
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should attempt to open Notepad', async () => {
      const result = await openNotepad();
      
      // On Windows, this should succeed with Notepad
      // On Linux, this should succeed with gedit or other text editor
      // On other platforms, it may fail, but should still return a valid result
      if (result.success) {
        // Message should contain either "Notepad", "Bloc de Notas", or "already open"
        expect(result.message).toMatch(/notepad|bloc de notas|abierto/i);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should return structured error information on failure', async () => {
      // Both functions should handle errors gracefully
      // Even if they succeed, we verify the structure is correct
      const calcResult = await openCalculator();
      const notepadResult = await openNotepad();
      
      // Verify error field exists when success is false
      if (!calcResult.success) {
        expect(calcResult.error).toBeDefined();
        expect(typeof calcResult.error).toBe('string');
      }
      
      if (!notepadResult.success) {
        expect(notepadResult.error).toBeDefined();
        expect(typeof notepadResult.error).toBe('string');
      }
    });
  });
});
