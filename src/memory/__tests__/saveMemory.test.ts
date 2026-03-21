import { describe, it, expect, afterEach } from 'vitest';
import { saveMemory } from '../local_memory';
import { readFile, unlink } from 'fs/promises';
import { resolve } from 'path';

describe('saveMemory', () => {
  const testFilePath = './test-memory.json';
  const absoluteTestPath = resolve(testFilePath);

  afterEach(async () => {
    // Clean up test file after each test
    try {
      await unlink(absoluteTestPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should save simple memory data successfully', async () => {
    const testData = { user: 'John', age: 30 };
    
    const result = await saveMemory(testData, testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    
    // Verify file was created and contains correct data
    const fileContent = await readFile(absoluteTestPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    expect(parsedData).toEqual(testData);
  });

  it('should save nested memory data successfully', async () => {
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
    
    const result = await saveMemory(testData, testFilePath);
    
    expect(result.success).toBe(true);
    
    // Verify nested structure is preserved
    const fileContent = await readFile(absoluteTestPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    expect(parsedData).toEqual(testData);
  });

  it('should format JSON with 2-space indentation', async () => {
    const testData = { key: 'value', nested: { prop: 'test' } };
    
    await saveMemory(testData, testFilePath);
    
    const fileContent = await readFile(absoluteTestPath, 'utf-8');
    
    // Check that the file is formatted with 2-space indentation
    expect(fileContent).toContain('  "key"');
    expect(fileContent).toContain('  "nested"');
  });

  it('should save empty object successfully', async () => {
    const testData = {};
    
    const result = await saveMemory(testData, testFilePath);
    
    expect(result.success).toBe(true);
    
    const fileContent = await readFile(absoluteTestPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    expect(parsedData).toEqual({});
  });

  it('should handle arrays in memory data', async () => {
    const testData = {
      items: ['item1', 'item2', 'item3'],
      numbers: [1, 2, 3]
    };
    
    const result = await saveMemory(testData, testFilePath);
    
    expect(result.success).toBe(true);
    
    const fileContent = await readFile(absoluteTestPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);
    expect(parsedData).toEqual(testData);
  });

  it('should return error for invalid file path', async () => {
    const testData = { key: 'value' };
    const invalidPath = '/invalid/path/that/does/not/exist/memory.json';
    
    const result = await saveMemory(testData, invalidPath);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed to save memory');
  });
});
