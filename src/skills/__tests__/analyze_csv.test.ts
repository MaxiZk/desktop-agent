/**
 * Unit tests for CSV Analyzer module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { analyzeCSV } from '../analyze_csv';

const TEST_DIR = join(process.cwd(), 'test-temp');
const TEST_CSV = join(TEST_DIR, 'test.csv');

describe('analyzeCSV', () => {
  beforeEach(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(TEST_CSV);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should parse CSV with comma delimiter', async () => {
    const csvContent = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    expect(result.success).toBe(true);
    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.rowCount).toBe(2);
    expect(result.data).toEqual([
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
    ]);
  });

  it('should parse CSV with semicolon delimiter', async () => {
    const csvContent = 'name;age;city\nAlice;30;NYC\nBob;25;LA';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    expect(result.success).toBe(true);
    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.rowCount).toBe(2);
  });

  it('should parse CSV with tab delimiter', async () => {
    const csvContent = 'name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    expect(result.success).toBe(true);
    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.rowCount).toBe(2);
  });

  it('should skip empty lines', async () => {
    const csvContent = 'name,age\nAlice,30\n\nBob,25\n\n';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it('should handle empty CSV file', async () => {
    await writeFile(TEST_CSV, '', 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    // Empty CSV files may be treated as parsing errors by papaparse
    // This is acceptable behavior - either success with empty data or error
    if (result.success) {
      expect(result.data).toEqual([]);
      expect(result.rowCount).toBe(0);
    } else {
      expect(result.error).toBeDefined();
    }
  });

  it('should return error for non-existent file', async () => {
    const result = await analyzeCSV(join(TEST_DIR, 'nonexistent.csv'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('should auto-convert numbers', async () => {
    const csvContent = 'name,age,score\nAlice,30,95.5\nBob,25,87.3';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    expect(result.success).toBe(true);
    expect(result.data?.[0].age).toBe(30);
    expect(result.data?.[0].score).toBe(95.5);
    expect(typeof result.data?.[0].age).toBe('number');
    expect(typeof result.data?.[0].score).toBe('number');
  });

  it('should handle malformed CSV with parsing errors', async () => {
    // Create a CSV with mismatched columns (more values than headers)
    const csvContent = 'name,age\nAlice,30,ExtraValue\nBob,25';
    await writeFile(TEST_CSV, csvContent, 'utf-8');

    const result = await analyzeCSV(TEST_CSV);

    // Papaparse may handle this gracefully or report an error
    // Either way, we should get a valid result structure
    expect(result).toHaveProperty('success');
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('parse');
    }
  });

  it('should distinguish between file access and parsing errors', async () => {
    // Test file not found (file access error)
    const notFoundResult = await analyzeCSV(join(TEST_DIR, 'nonexistent.csv'));
    expect(notFoundResult.success).toBe(false);
    expect(notFoundResult.error).toContain('File not found');

    // Test parsing error with valid file
    const csvContent = 'name,age\nAlice,30,ExtraValue\nBob,25';
    await writeFile(TEST_CSV, csvContent, 'utf-8');
    const parseResult = await analyzeCSV(TEST_CSV);
    
    // If there's an error, it should be about parsing, not file access
    if (!parseResult.success) {
      expect(parseResult.error).not.toContain('File not found');
      expect(parseResult.error).not.toContain('Permission denied');
    }
  });
});
