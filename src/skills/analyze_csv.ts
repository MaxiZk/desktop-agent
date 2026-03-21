/**
 * CSV Analyzer Module
 * 
 * Provides TypeScript interfaces and types for CSV parsing and analysis.
 * This module defines the data structures used by the CSV analyzer functionality.
 */

import { readFile } from 'fs/promises';
import Papa from 'papaparse';

/**
 * Represents a single row from a parsed CSV file.
 * Keys are column headers (strings), values can be strings or numbers.
 */
export interface CSVRow {
  [key: string]: string | number;
}

/**
 * Result object returned by CSV analysis operations.
 * Contains parsed data, metadata, and error information.
 */
export interface CSVAnalysisResult {
  /** Whether the CSV was parsed successfully */
  success: boolean;
  
  /** Parsed rows as structured objects (present if success=true) */
  data?: CSVRow[];
  
  /** Column headers extracted from the CSV (present if success=true) */
  headers?: string[];
  
  /** Number of data rows parsed (present if success=true) */
  rowCount?: number;
  
  /** Error message if parsing failed (present if success=false) */
  error?: string;
}

/**
 * Analyzes a CSV file by parsing its contents and extracting structured data.
 * 
 * @param filePath - Path to the CSV file to analyze
 * @returns Promise resolving to CSVAnalysisResult with parsed data or error information
 * 
 * @example
 * ```typescript
 * const result = await analyzeCSV('./data.csv');
 * if (result.success) {
 *   console.log(`Parsed ${result.rowCount} rows with headers:`, result.headers);
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function analyzeCSV(filePath: string): Promise<CSVAnalysisResult> {
  try {
    // Read the file content
    const fileContent = await readFile(filePath, 'utf-8');
    
    // Parse CSV using papaparse with configuration
    const parseResult = Papa.parse(fileContent, {
      header: true,              // Detect and use headers
      dynamicTyping: true,       // Auto-convert numbers
      skipEmptyLines: true,      // Skip empty lines
      delimiter: '',             // Auto-detect delimiter (comma, semicolon, tab)
    });
    
    // Check for parsing errors
    if (parseResult.errors && parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors
        .map(err => `${err.message} (row ${err.row})`)
        .join('; ');
      return {
        success: false,
        error: `Failed to parse CSV: ${errorMessages}`,
      };
    }
    
    // Extract headers from meta information
    const headers = parseResult.meta.fields || [];
    
    // Get parsed data
    const data = parseResult.data as CSVRow[];
    
    return {
      success: true,
      data,
      headers,
      rowCount: data.length,
    };
  } catch (error) {
    // Handle file reading errors
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      
      if (nodeError.code === 'ENOENT') {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      } else if (nodeError.code === 'EACCES') {
        return {
          success: false,
          error: `Permission denied reading file: ${filePath}`,
        };
      }
      
      return {
        success: false,
        error: `Error reading file: ${error.message}`,
      };
    }
    
    return {
      success: false,
      error: 'Unknown error occurred while analyzing CSV',
    };
  }
}
