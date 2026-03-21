/**
 * FreeFormHandler.test.ts — Tests for free-form chat handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFreeForm } from '../FreeFormHandler.js';
import { SkillRegistry } from '../../SkillRegistry.js';
import { ExcelSkill } from '../../impl/ExcelSkill.js';
import { AppSkill } from '../../impl/AppSkill.js';

// Mock the ollama_ai module
vi.mock('../../../ai/ollama_ai.js', () => ({
  generateAIResponse: vi.fn(),
}));

import { generateAIResponse } from '../../../ai/ollama_ai.js';

describe('FreeFormHandler', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new SkillRegistry()
      .register(new ExcelSkill())
      .register(new AppSkill());
  });

  describe('handleFreeForm', () => {
    it('should return SkillResult structure always', async () => {
      // Mock Ollama chat response
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'chat',
          response: 'Hola, ¿cómo estás?',
        }),
      });

      const result = await handleFreeForm('hola', registry);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should handle chat type response', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'chat',
          response: 'Estoy bien, gracias por preguntar.',
        }),
      });

      const result = await handleFreeForm('como estas?', registry);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Estoy bien, gracias por preguntar.');
    });

    it('should handle action type response', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'action',
          intent: 'open_app',
          params: { appName: 'chrome' },
          response: 'Listo, abrí Chrome.',
        }),
      });

      const result = await handleFreeForm('quiero abrir chrome', registry);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Listo, abrí Chrome.');
    });

    it('should handle invalid JSON from Ollama gracefully', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'This is not valid JSON',
      });

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pude entender');
    });

    it('should handle malformed JSON gracefully', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: '{ "type": "chat", "response": ',
      });

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pude entender');
    });

    it('should handle Ollama timeout gracefully', async () => {
      // Mock Ollama taking longer than 15 seconds
      vi.mocked(generateAIResponse).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, response: 'Too late' });
          }, 16000);
        })
      );

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('tiempo');
    }, 20000); // Test timeout extended to 20s

    it('should handle Ollama unavailable gracefully', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: false,
        error: 'Ollama service unavailable',
        errorType: 'CONNECTION_FAILED',
      });

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pude entender');
    });

    it('should handle missing response field gracefully', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'chat',
          // Missing response field
        }),
      });

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pude entender');
    });

    it('should handle action with invalid intent gracefully', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'action',
          intent: 'nonexistent_intent',
          params: {},
          response: 'Intenté hacer algo.',
        }),
      });

      const result = await handleFreeForm('test', registry);

      // Should fallback to chat response
      expect(result.success).toBe(true);
      expect(result.message).toBe('Intenté hacer algo.');
    });

    it('should extract JSON from text with extra content', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'Here is the response: {"type": "chat", "response": "Hola"} and some more text',
      });

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Hola');
    });

    it('should handle exception during execution gracefully', async () => {
      vi.mocked(generateAIResponse).mockRejectedValue(new Error('Network error'));

      const result = await handleFreeForm('test', registry);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pude entender');
    });

    it('should call generateAIResponse with correct prompt structure', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: JSON.stringify({
          type: 'chat',
          response: 'Test response',
        }),
      });

      await handleFreeForm('test message', registry);

      expect(generateAIResponse).toHaveBeenCalledWith(
        expect.stringContaining('Jarvis'),
        'llama3.2:1b',
        false
      );

      const callArgs = vi.mocked(generateAIResponse).mock.calls[0];
      const prompt = callArgs[0];

      expect(prompt).toContain('test message');
      expect(prompt).toContain('excel');
      expect(prompt).toContain('app');
      expect(prompt).toContain('type');
      expect(prompt).toContain('action');
      expect(prompt).toContain('chat');
    });
  });
});
