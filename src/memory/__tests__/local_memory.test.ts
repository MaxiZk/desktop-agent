import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveMemory, loadMemory, MemoryData } from '../local_memory';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

describe('Memory Store - Error Handling', () => {
  const testDir = resolve('./test-memory');
  const testFile = resolve(testDir, 'test-memory.json');

  beforeEach(async () => {
    // Create test directory
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      if (existsSync(testFile)) {
        await unlink(testFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('saveMemory - Error Handling (Requirement 6.6)', () => {
    it('should catch and return file write errors', async () => {
      // Try to write to an invalid path
      const invalidPath = resolve('/invalid/path/that/does/not/exist/memory.json');
      const testData: MemoryData = { test: 'data' };

      const result = await saveMemory(testData, invalidPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to save memory');
    });

    it('should successfully save simple objects', async () => {
      const testData: MemoryData = { key: 'value', number: 42 };

      const result = await saveMemory(testData, testFile);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('loadMemory - Error Handling (Requirement 6.6)', () => {
    it('should catch JSON parsing errors and return PARSE_ERROR type', async () => {
      // Write corrupted JSON to file
      const corruptedJSON = '{ "key": "value", invalid json }';
      await writeFile(testFile, corruptedJSON, 'utf-8');

      const result = await loadMemory(testFile);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to parse memory file');
      expect(result.errorType).toBe('PARSE_ERROR');
    });

    it('should handle incomplete JSON and return PARSE_ERROR', async () => {
      // Write incomplete JSON
      const incompleteJSON = '{ "key": "value"';
      await writeFile(testFile, incompleteJSON, 'utf-8');

      const result = await loadMemory(testFile);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('PARSE_ERROR');
    });

    it('should handle malformed JSON and return PARSE_ERROR', async () => {
      // Write malformed JSON
      const malformedJSON = 'not json at all';
      await writeFile(testFile, malformedJSON, 'utf-8');

      const result = await loadMemory(testFile);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('PARSE_ERROR');
    });

    it('should return empty object when file does not exist', async () => {
      const nonExistentFile = resolve(testDir, 'does-not-exist.json');

      const result = await loadMemory(nonExistentFile);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
      expect(result.error).toBeUndefined();
    });
  });

  describe('Corrupted Files Do Not Crash Application (Requirement 6.6)', () => {
    it('should handle corrupted files gracefully without throwing', async () => {
      const corruptedJSON = '{ corrupted }';
      await writeFile(testFile, corruptedJSON, 'utf-8');

      // This should not throw an exception
      const result = await loadMemory(testFile);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('PARSE_ERROR');
    });

    it('should handle empty file gracefully', async () => {
      await writeFile(testFile, '', 'utf-8');

      const result = await loadMemory(testFile);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('PARSE_ERROR');
    });
  });

  describe('Nested Object Structures Support (Requirement 6.7)', () => {
    it('should support saving and loading deeply nested objects', async () => {
      const nestedData: MemoryData = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep value',
                  array: [1, 2, 3]
                }
              }
            }
          }
        }
      };

      const saveResult = await saveMemory(nestedData, testFile);
      expect(saveResult.success).toBe(true);

      const loadResult = await loadMemory(testFile);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data).toEqual(nestedData);
    });

    it('should support nested arrays within objects', async () => {
      const complexData: MemoryData = {
        users: [
          { id: 1, name: 'Alice', tags: ['admin', 'user'] },
          { id: 2, name: 'Bob', tags: ['user'] }
        ],
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      };

      const saveResult = await saveMemory(complexData, testFile);
      expect(saveResult.success).toBe(true);

      const loadResult = await loadMemory(testFile);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data).toEqual(complexData);
    });

    it('should support objects with mixed types', async () => {
      const mixedData: MemoryData = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', { three: 3 }],
        object: {
          nested: {
            value: 'nested'
          }
        }
      };

      const saveResult = await saveMemory(mixedData, testFile);
      expect(saveResult.success).toBe(true);

      const loadResult = await loadMemory(testFile);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data).toEqual(mixedData);
    });
  });

  describe('Round Trip Integrity', () => {
    it('should preserve data integrity through save and load cycle', async () => {
      const originalData: MemoryData = {
        user: {
          id: 123,
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              language: 'en'
            }
          }
        },
        session: {
          token: 'abc123',
          expires: 1234567890
        }
      };

      await saveMemory(originalData, testFile);
      const result = await loadMemory(testFile);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(originalData);
    });
  });
});
