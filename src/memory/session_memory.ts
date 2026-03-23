/**
 * Session Memory Module
 * 
 * Manages persistent conversation history across app sessions.
 * Stores messages in logs/session_memory.json with a rolling window of 50 messages.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Structure of a session message
 */
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SESSION_FILE = join(process.cwd(), 'logs', 'session_memory.json');
const MAX_MESSAGES = 50; // Rolling window size

/**
 * Load session history from persistent storage
 * 
 * @param limit - Maximum number of recent messages to return (default: 20)
 * @returns Array of session messages, newest last
 */
export async function loadSessionHistory(limit: number = 20): Promise<SessionMessage[]> {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf-8');
    const messages: SessionMessage[] = JSON.parse(data);
    
    // Return last N messages
    return messages.slice(-limit);
  } catch (error) {
    // File doesn't exist or is invalid - return empty array
    return [];
  }
}

/**
 * Save a message to session history
 * 
 * Appends the message and maintains a rolling window of MAX_MESSAGES.
 * Creates the logs directory if it doesn't exist.
 * 
 * @param msg - The message to save
 */
export async function saveSessionMessage(msg: SessionMessage): Promise<void> {
  try {
    // Ensure logs directory exists
    const logsDir = join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    // Load existing messages
    let messages: SessionMessage[] = [];
    try {
      const data = await fs.readFile(SESSION_FILE, 'utf-8');
      messages = JSON.parse(data);
    } catch {
      // File doesn't exist yet - start with empty array
    }

    // Append new message
    messages.push(msg);

    // Keep only last MAX_MESSAGES (rolling window)
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }

    // Write back to file
    await fs.writeFile(SESSION_FILE, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving session message:', error);
    throw error;
  }
}

/**
 * Clear all session history
 * 
 * Deletes the session memory file.
 */
export async function clearSessionHistory(): Promise<void> {
  try {
    await fs.unlink(SESSION_FILE);
  } catch (error) {
    // File doesn't exist - that's fine
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Error clearing session history:', error);
      throw error;
    }
  }
}
