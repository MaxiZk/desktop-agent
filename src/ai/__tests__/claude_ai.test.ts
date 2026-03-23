import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Anthropic SDK before importing
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      };
    },
    mockCreate, // Export for test access
  };
});

import { askClaude } from '../claude_ai.js';
import type { ClaudeMessage } from '../claude_ai.js';

// Get the mock function
const { mockCreate } = await import('@anthropic-ai/sdk') as any;

describe('claude_ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    // Reset environment variable
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('askClaude', () => {
    it('should return error when API key is not set', async () => {
      const result = await askClaude('test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ANTHROPIC_API_KEY not set');
      expect(result.response).toBeUndefined();
    });

    it('should return ClaudeResponse structure', async () => {
      // Set API key
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Mock successful response
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Test response' },
        ],
      });

      const result = await askClaude('test message');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('response');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle conversation history', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Response with history' },
        ],
      });

      const history: ClaudeMessage[] = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      await askClaude('new message', history);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new
    });

    it('should limit history to last 8 messages', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Response' },
        ],
      });

      // Create 10 history messages
      const history: ClaudeMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ClaudeMessage[];

      await askClaude('new message', history);

      const callArgs = mockCreate.mock.calls[0][0];
      // Should have last 8 from history + 1 new = 9 total
      expect(callArgs.messages).toHaveLength(9);
    });

    it('should handle API errors gracefully', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await askClaude('test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.response).toBeUndefined();
    });

    it('should extract text from multiple content blocks', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: ' Second part' },
        ],
      });

      const result = await askClaude('test message');

      expect(result.success).toBe(true);
      expect(result.response).toBe('First part Second part');
    });
  });
});
