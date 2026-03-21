import { describe, it, expect, afterEach } from 'vitest';
import { loadMemory, saveMemory } from '../local_memory';
import { writeFile, unlink } from 'fs/promises';
import { resolve } from 'path';

/**
 * Test suite specifically for Task 7.3 requirements:
 * - Use Node.js fs.promises.readFile() for loading
 * - Use JSON.parse() to deserialize
 * - If file doesn't exist, return empty object {} with success=true
 * - Return MemoryLoadResult with memory data
 * - Requirements: 6.3, 6.4, 6.5
 */
describe('loadMemory - Task 7.3 Requirements', () => {
  const testFilePath = './test-requirements-memory.json';
  const absoluteTestPath = resolve(testFilePath);

  afterEach(async () => {
    try {
      await unlink(absoluteTestPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('Requirement 6.3: Should read JSON file and return memory data', async () => {
    const testData = { key: 'value', nested: { prop: 'test' } };
    await saveMemory(testData, testFilePath);
    
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual(testData);
  });

  it('Requirement 6.4: Should parse JSON file and return memory data as object', async () => {
    const testData = { user: 'Alice', settings: { theme: 'light' } };
    await saveMemory(testData, testFilePath);
    
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(true);
    expect(typeof result.data).toBe('object');
    expect(result.data).toEqual(testData);
  });

  it('Requirement 6.5: Should return empty object {} with success=true if file does not exist', async () => {
    const result = await loadMemory('./non-existent-file-xyz.json');
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
    expect(result.error).toBeUndefined();
  });

  it('Should return MemoryLoadResult with correct structure', async () => {
    const testData = { test: 'data' };
    await saveMemory(testData, testFilePath);
    
    const result = await loadMemory(testFilePath);
    
    // Verify MemoryLoadResult structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(typeof result.success).toBe('boolean');
  });

  it('Should use JSON.parse() to deserialize (verify by checking data types)', async () => {
    const testData = {
      string: 'text',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      object: { nested: 'value' }
    };
    await saveMemory(testData, testFilePath);
    
    const result = await loadMemory(testFilePath);
    
    // If JSON.parse() is used correctly, all data types should be preserved
    expect(result.data?.string).toBe('text');
    expect(result.data?.number).toBe(42);
    expect(result.data?.boolean).toBe(true);
    expect(result.data?.null).toBe(null);
    expect(Array.isArray(result.data?.array)).toBe(true);
    expect(typeof result.data?.object).toBe('object');
  });

  it('Should handle corrupted JSON gracefully', async () => {
    await writeFile(absoluteTestPath, '{ invalid json }', 'utf-8');
    
    const result = await loadMemory(testFilePath);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.errorType).toBe('PARSE_ERROR');
  });
});
