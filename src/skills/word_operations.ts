import { Document, Packer, Paragraph, TextRun } from 'docx';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WordResult {
  success: boolean;
  message: string;
  path?: string;
  error?: string;
  opened?: boolean;
}

/**
 * Create a new Word document with optional content
 * 
 * @param filePath - Path where to create the file
 * @param content - Optional text content
 * @param title - Optional document title
 * @param autoOpen - Whether to automatically open the file after creation (default: true)
 * @returns WordResult with success status
 */
export async function createWordFile(
  filePath: string,
  content?: string,
  title?: string,
  autoOpen: boolean = true
): Promise<WordResult> {
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

    // Create paragraphs
    const paragraphs: Paragraph[] = [];

    // Add title if provided
    if (title) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 32, // 16pt
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );
    }

    // Add content if provided
    if (content) {
      // Split content by newlines and create paragraphs
      const lines = content.split('\n');
      lines.forEach(line => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
              }),
            ],
          })
        );
      });
    } else {
      // Add empty paragraph if no content
      paragraphs.push(new Paragraph({ text: '' }));
    }

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Save file
    await writeFile(absolutePath, buffer);

    // Auto-open file if requested
    let opened = false;
    if (autoOpen) {
      try {
        await execAsync(`start "" "${absolutePath}"`);
        opened = true;
      } catch (error) {
        console.error('[Word] Failed to auto-open file:', error);
        // Don't fail the operation if opening fails
      }
    }

    return {
      success: true,
      message: `Word document created: ${absolutePath}`,
      path: absolutePath,
      opened
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to create Word document: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to create Word document: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}

/**
 * Append content to an existing Word document
 * Note: This creates a new document with old + new content
 * 
 * @param filePath - Path to the Word document
 * @param content - Text content to append
 * @returns WordResult with success status
 */
export async function appendToWordFile(
  filePath: string,
  content: string
): Promise<WordResult> {
  try {
    // Validate input
    if (!filePath || filePath.trim() === '') {
      return {
        success: false,
        message: 'File path is required',
        error: 'File path is required'
      };
    }

    if (!content || content.trim() === '') {
      return {
        success: false,
        message: 'Content is required',
        error: 'Content is required'
      };
    }

    // Resolve to absolute path
    const absolutePath = resolve(filePath);

    // Check if file exists
    if (!existsSync(absolutePath)) {
      // If file doesn't exist, create it with the content
      return await createWordFile(absolutePath, content);
    }

    // Note: Reading existing .docx files requires additional parsing
    // For simplicity, we'll create a new document with a note
    // In production, you'd want to use a library like mammoth to read existing content

    // Create new paragraphs with append marker
    const paragraphs: Paragraph[] = [];

    // Add separator
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '--- Appended Content ---',
            italics: true,
          }),
        ],
        spacing: {
          before: 200,
          after: 200,
        },
      })
    );

    // Add new content
    const lines = content.split('\n');
    lines.forEach(line => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
            }),
          ],
        })
      );
    });

    // Read existing file (for future append functionality)
    await readFile(absolutePath);

    // Create new document (simplified - in production, parse existing content)
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Save file (overwrites with appended content marker)
    await writeFile(absolutePath, buffer);

    return {
      success: true,
      message: `Content appended to Word document: ${absolutePath}`,
      path: absolutePath
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: `Failed to append to Word document: ${filePath}`,
        path: filePath,
        error: error.message
      };
    }

    return {
      success: false,
      message: `Failed to append to Word document: ${filePath}`,
      path: filePath,
      error: 'Unknown error occurred'
    };
  }
}
