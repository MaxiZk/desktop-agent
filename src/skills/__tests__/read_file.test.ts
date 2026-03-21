import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile } from '../read_file';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

describe('readFile', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const testFilePath = join(testDir, 'test-file.txt');
  const testContent = 'Hello, World! This is a test file.';

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should read existing file and return content', async () => {
    // Create test file
    await writeFile(testFilePath, testContent, 'utf-8');

    const result = await readFile(testFilePath);

    expect(result.success).toBe(true);
    expect(result.content).toBe(testContent);
    expect(result.error).toBeUndefined();
    expect(result.errorType).toBeUndefined();
  });

  it('should return NOT_FOUND error for non-existent file', async () => {
    const nonExistentPath = join(testDir, 'non-existent-file.txt');

    const result = await readFile(nonExistentPath);

    expect(result.success).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('File not found');
    expect(result.error).toContain(nonExistentPath);
    expect(result.errorType).toBe('NOT_FOUND');
  });

  it('should read empty file and return empty string', async () => {
    // Create empty test file
    await writeFile(testFilePath, '', 'utf-8');

    const result = await readFile(testFilePath);

    expect(result.success).toBe(true);
    expect(result.content).toBe('');
    expect(result.error).toBeUndefined();
  });

  it('should preserve UTF-8 characters including non-ASCII', async () => {
    const utf8Content = 'Hello 世界! Привет мир! 🚀 émojis and spëcial çhars';
    await writeFile(testFilePath, utf8Content, 'utf-8');

    const result = await readFile(testFilePath);

    expect(result.success).toBe(true);
    expect(result.content).toBe(utf8Content);
  });
});
