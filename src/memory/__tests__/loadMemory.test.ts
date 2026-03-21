import { describe, it, expect, afterEach } from 'vitest';
import { loadMemory, saveMemory } from '../local_memory';
import { writeFile, unlink } from 'fs/promises';
import { resolve } from 'path';

describe('loadMemory', () => {
  const testFilePath = './test-load-memory.json';
  const absoluteTestPath = resolve(testFilePath);

  afterEach(async () => {
    // Clean up test file after each test
    try {
      await unlink(absoluteTestPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should load simple memory data successfully', async () => {
    const testData = { user: 'John', age: 30 };
    
    // First save the data
    await saveMemory(testData, testFilePath);
    
    // Then load it
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
    expect(result.error).toBeUndefined();
  });

  it('should load nested memory data successfully', async () => {
    const testData = {
      user: 'Jane',
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          push: false
        }
      }
    };
    
    await saveMemory(testData, testFilePath);
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
  });

  it('should return empty object when file does not exist', async () => {
    const result = await loadMemory('./non-existent-file.json');
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
    expect(result.error).toBeUndefined();
  });

  it('should load empty object successfully', async () => {
    const testData = {};
    
    await saveMemory(testData, testFilePath);
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('should handle arrays in memory data', async () => {
    const testData = {
      items: ['item1', 'item2', 'item3'],
      numbers: [1, 2, 3]
    };
    
    await saveMemory(testData, testFilePath);
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
  });

  it('should return PARSE_ERROR for corrupted JSON', async () => {
    // Write invalid JSON to file
    await writeFile(absoluteTestPath, '{ invalid json content }', 'utf-8');
    
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to parse memory file');
    expect(result.errorType).toBe('PARSE_ERROR');
  });

  it('should return PARSE_ERROR for incomplete JSON', async () => {
    // Write incomplete JSON to file
    await writeFile(absoluteTestPath, '{ "key": "value"', 'utf-8');
    
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('PARSE_ERROR');
  });

  it('should handle complex nested structures', async () => {
    const testData = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'deep nested value',
              array: [1, 2, { nested: 'object' }]
            }
          }
        }
      }
    };
    
    await saveMemory(testData, testFilePath);
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
  });

  it('should preserve data types when loading', async () => {
    const testData = {
      string: 'text',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 'two', true],
      object: { nested: 'value' }
    };
    
    await saveMemory(testData, testFilePath);
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
    expect(typeof result.data?.number).toBe('number');
    expect(typeof result.data?.boolean).toBe('boolean');
    expect(typeof result.data?.string).toBe('string');
  });
});
