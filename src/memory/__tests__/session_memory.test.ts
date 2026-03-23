import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  loadSessionHistory,
  saveSessionMessage,
  clearSessionHistory,
  SessionMessage
} from '../session_memory';

const TEST_SESSION_FILE = join(process.cwd(), 'logs', 'session_memory.json');

describe('session_memory', () => {
  // Clean up before and after each test
  beforeEach(async () => {
    try {
      await fs.unlink(TEST_SESSION_FILE);
    } catch {
      // File doesn't exist - that's fine
    }
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_SESSION_FILE);
    } catch {
      // File doesn't exist - that's fine
    }
  });

  describe('loadSessionHistory', () => {
    it('should return empty array when file does not exist', async () => {
      const history = await loadSessionHistory();
      expect(history).toEqual([]);
    });

    it('should load messages from file', async () => {
      const messages: SessionMessage[] = [
        { role: 'user', content: 'Hola', timestamp: '2024-01-01T10:00:00Z' },
        { role: 'assistant', content: 'Hola!', timestamp: '2024-01-01T10:00:01Z' }
      ];

      // Create file manually
      await fs.mkdir(join(process.cwd(), 'logs'), { recursive: true });
      await fs.writeFile(TEST_SESSION_FILE, JSON.stringify(messages), 'utf-8');

      const history = await loadSessionHistory();
      expect(history).toEqual(messages);
    });

    it('should respect limit parameter', async () => {
      const messages: SessionMessage[] = [];
      for (let i = 0; i < 30; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date().toISOString()
        });
      }

      await fs.mkdir(join(process.cwd(), 'logs'), { recursive: true });
      await fs.writeFile(TEST_SESSION_FILE, JSON.stringify(messages), 'utf-8');

      const history = await loadSessionHistory(10);
      expect(history.length).toBe(10);
      expect(history[0].content).toBe('Message 20');
      expect(history[9].content).toBe('Message 29');
    });
  });

  describe('saveSessionMessage', () => {
    it('should create file and save message', async () => {
      const message: SessionMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString()
      };

      await saveSessionMessage(message);

      const data = await fs.readFile(TEST_SESSION_FILE, 'utf-8');
      const saved = JSON.parse(data);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toEqual(message);
    });

    it('should append to existing messages', async () => {
      const msg1: SessionMessage = {
        role: 'user',
        content: 'First',
        timestamp: '2024-01-01T10:00:00Z'
      };
      const msg2: SessionMessage = {
        role: 'assistant',
        content: 'Second',
        timestamp: '2024-01-01T10:00:01Z'
      };

      await saveSessionMessage(msg1);
      await saveSessionMessage(msg2);

      const data = await fs.readFile(TEST_SESSION_FILE, 'utf-8');
      const saved = JSON.parse(data);
      expect(saved).toHaveLength(2);
      expect(saved[0]).toEqual(msg1);
      expect(saved[1]).toEqual(msg2);
    });

    it('should maintain rolling window of 50 messages', async () => {
      // Save 55 messages
      for (let i = 0; i < 55; i++) {
        await saveSessionMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: new Date().toISOString()
        });
      }

      const data = await fs.readFile(TEST_SESSION_FILE, 'utf-8');
      const saved = JSON.parse(data);
      
      // Should only keep last 50
      expect(saved).toHaveLength(50);
      expect(saved[0].content).toBe('Message 5');
      expect(saved[49].content).toBe('Message 54');
    });
  });

  describe('clearSessionHistory', () => {
    it('should delete the session file', async () => {
      // Create a file first
      await saveSessionMessage({
        role: 'user',
        content: 'Test',
        timestamp: new Date().toISOString()
      });

      // Verify file exists
      await expect(fs.access(TEST_SESSION_FILE)).resolves.toBeUndefined();

      // Clear history
      await clearSessionHistory();

      // Verify file is deleted
      await expect(fs.access(TEST_SESSION_FILE)).rejects.toThrow();
    });

    it('should not throw error if file does not exist', async () => {
      // Should not throw
      await expect(clearSessionHistory()).resolves.toBeUndefined();
    });
  });
});
