/**
 * NarratorService.test.ts — Tests for natural language narration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { narrateResult } from '../NarratorService.js';
import type { SkillResult } from '../../Skill.js';

// Mock the ollama_ai module
vi.mock('../../../ai/ollama_ai.js', () => ({
  generateAIResponse: vi.fn(),
}));

import { generateAIResponse } from '../../../ai/ollama_ai.js';

describe('NarratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('narrateResult', () => {
    it('should return a string always (never throws)', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      // Mock Ollama success
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'Necesitás algo más?',
      });

      const narrated = await narrateResult(mockResult);

      expect(typeof narrated).toBe('string');
      expect(narrated.length).toBeGreaterThan(0);
    });

    it('should return narrated message when Ollama succeeds', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'Necesitás algo más?',
      });

      const narrated = await narrateResult(mockResult);

      expect(narrated).toBe('Chrome opened successfully. ¿Necesitás algo más?');
      expect(generateAIResponse).toHaveBeenCalledOnce();
    });

    it('should return original message when Ollama fails', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      // Mock Ollama failure
      vi.mocked(generateAIResponse).mockResolvedValue({
        success: false,
        error: 'Ollama service unavailable',
        errorType: 'CONNECTION_FAILED',
      });

      const narrated = await narrateResult(mockResult);

      expect(narrated).toBe('Abrí Chrome ¿Necesitás algo más?');
    });

    it('should return original message when Ollama times out', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      // Mock Ollama timeout (takes longer than 8 seconds)
      vi.mocked(generateAIResponse).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, response: 'Too late' });
          }, 9000);
        })
      );

      const narrated = await narrateResult(mockResult);

      expect(narrated).toBe('Abrí Chrome ¿Necesitás algo más?');
    }, 10000); // Test timeout extended to 10s

    it('should return original message when Ollama throws error', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      // Mock Ollama throwing an error
      vi.mocked(generateAIResponse).mockRejectedValue(new Error('Network error'));

      const narrated = await narrateResult(mockResult);

      expect(narrated).toBe('Abrí Chrome ¿Necesitás algo más?');
    });

    it('should preserve result structure after narration', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
        data: { appName: 'chrome', pid: 12345 },
      };

      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'Querés que haga algo más?',
      });

      const narrated = await narrateResult(mockResult);

      // Narration only changes the message, not the result structure
      expect(typeof narrated).toBe('string');
      expect(mockResult.data).toEqual({ appName: 'chrome', pid: 12345 });
    });

    it('should call generateAIResponse with correct prompt structure', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'File read successfully',
      };

      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: 'Necesitás algo más?',
      });

      await narrateResult(mockResult);

      expect(generateAIResponse).toHaveBeenCalledWith(
        expect.stringContaining('Completá esta frase'),
        'llama3.2:1b',
        false
      );

      const callArgs = vi.mocked(generateAIResponse).mock.calls[0];
      const prompt = callArgs[0];

      expect(prompt).toContain('File read successfully');
    });

    it('should trim whitespace from Ollama response', async () => {
      const mockResult: SkillResult = {
        success: true,
        message: 'Chrome opened successfully',
      };

      vi.mocked(generateAIResponse).mockResolvedValue({
        success: true,
        response: '  Necesitás algo más?  \n',
      });

      const narrated = await narrateResult(mockResult);

      expect(narrated).toBe('Chrome opened successfully. ¿Necesitás algo más?');
    });
  });
});
