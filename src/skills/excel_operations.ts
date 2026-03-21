import ExcelJS from 'exceljs';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExcelResult {
  success: boolean;
  message: string;
  path?: string;
  data?: any;
  error?: string;
  opened?: boolean;
}

/**
 * Create a new Excel file with optional data
 * 
 * @param filePath - Path where to create the file
 * @param data - Optional array of arrays for initial data
 * @param headers - Optional array of header names
 * @param autoOpen - Whether to automatically open the file after creation (default: true)
 * @returns ExcelResult with success status
 */
export async function createExcelFile(
  filePath: string,
  data?: any[][],
  headers?: string[],
  autoOpen: boolean = true
): Promise<ExcelResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        message: 'File path is required',
        error: 'File path is required'
      };
    }

    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Ensure directory exists
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // Add headers if provided
    if (headers && headers.length > 0) {
      worksheet.addRow(headers);
      // Style headers
      worksheet.getRow(1).font = { bold: true };
    }

    // Add data if provided
    if (data && data.length > 0) {
      data.forEach(row => {
        worksheet.addRow(row);
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column) {
        column.width = 15;
      }
    });

    // Save file
    await workbook.xlsx.writeFile(absolutePath);

    // Auto-open file if requested
    let opened = false;
    if (autoOpen) {
      try {
        await execAsync(`start "" "${absolutePath}"`);
        opened = true;
      } catch (error) {
        console.error('[Excel] Failed to auto-open file:', error);
        // Don't fail the operation if opening fails
      }
    }

    return {
      success: true,
      message: `Excel file created: ${absolutePath}`,
      path: absolutePath,
      opened
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to create Excel file: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to create Excel file: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Read data from an Excel file
 * 
 * @param filePath - Path to the Excel file
 * @returns ExcelResult with file data
 */
export async function readExcelFile(filePath: string): Promise<ExcelResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        message: 'File path is required',
        error: 'File path is required'
      };
    }

    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      return {
        success: false,
        message: `File not found: ${absolutePath}`,
        path: absolutePath,
        error: 'File not found'
      };
    }

    // Read workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(absolutePath);

    // Get first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        success: false,
        message: 'No worksheets found in file',
        path: absolutePath,
        error: 'No worksheets found'
      };
    }

    // Extract data
    const data: any[][] = [];
    worksheet.eachRow((row, _rowNumber) => {
      const rowData: any[] = [];
      row.eachCell((cell, _colNumber) => {
        rowData.push(cell.value);
      });
      data.push(rowData);
    });

    return {
      success: true,
      message: `Excel file read: ${absolutePath} (${data.length} rows)`,
      path: absolutePath,
      data
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to read Excel file: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to read Excel file: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Write data to an existing Excel file or create new one
 * 
 * @param filePath - Path to the Excel file
 * @param data - Array of arrays to write
 * @param sheetName - Optional sheet name (default: Sheet1)
 * @returns ExcelResult with success status
 */
export async function writeExcelFile(
  filePath: string,
  data: any[][],
  sheetName: string = 'Sheet1'
): Promise<ExcelResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        message: 'File path is required',
        error: 'File path is required'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'Data is required',
        error: 'Data is required'
      };
    }

    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Ensure directory exists
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Create or load workbook
    const workbook = new ExcelJS.Workbook();
    let worksheet;

    if (existsSync(absolutePath)) {
      // Load existing file
      await workbook.xlsx.readFile(absolutePath);
      worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(sheetName);
      } else {
        // Clear existing data
        worksheet.spliceRows(1, worksheet.rowCount);
      }
    } else {
      // Create new worksheet
      worksheet = workbook.addWorksheet(sheetName);
    }

    // Add data
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column) {
        column.width = 15;
      }
    });

    // Save file
    await workbook.xlsx.writeFile(absolutePath);

    return {
      success: true,
      message: `Excel file written: ${absolutePath} (${data.length} rows)`,
      path: absolutePath
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to write Excel file: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to write Excel file: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}
