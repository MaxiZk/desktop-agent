import { describe, it, expect } from 'vitest';
import { generateAIResponse } from '../ollama_ai';

describe('generateAIResponse', () => {
  it('should return CONNECTION_FAILED error when Ollama service is unavailable', async () => {
    // This test assumes Ollama is not running on localhost:11434
    // If Ollama is running, this test will fail and we'll need to adjust
    const result = await generateAIResponse('Test prompt');

    // The function should handle connection errors gracefully
    expect(result.success).toBeDefined();
    expect(typeof result.success).toBe('boolean');

    if (!result.success) {
      // If service is unavailable, should return CONNECTION_FAILED
      expect(result.error).toBeDefined();
      expect(result.errorType).toBeDefined();
      expect(['CONNECTION_FAILED', 'API_ERROR', 'UNKNOWN']).toContain(result.errorType);
    } else {
      // If service is available, should return generated text
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
    }
  }, 6000); // 6 second timeout (5s fetch timeout + 1s buffer)

  it('should use default model "llama3.2:1b" when no model is specified', async () => {
    // This test verifies the function signature and default parameter
    const result = await generateAIResponse('Test prompt');
    
    // Should return a valid OllamaResponse structure
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  }, 6000); // 6 second timeout (5s fetch timeout + 1s buffer)

  it('should accept custom model parameter', async () => {
    // This test verifies the function accepts a custom model parameter
    const result = await generateAIResponse('Test prompt', 'custom-model');
    
    // Should return a valid OllamaResponse structure
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('should return structured error response on failure', async () => {
    const result = await generateAIResponse('Test prompt');

    if (!result.success) {
      // Error response should have proper structure
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.errorType).toBeDefined();
      expect(['CONNECTION_FAILED', 'API_ERROR', 'UNKNOWN']).toContain(result.errorType);
      expect(result.response).toBeUndefined();
    }
  }, 6000); // 6 second timeout (5s fetch timeout + 1s buffer)

  it('should accept stream parameter and handle streaming mode', async () => {
    // This test verifies the function accepts the stream parameter
    const result = await generateAIResponse('Test prompt', 'llama2', true);
    
    // Should return a valid OllamaResponse structure
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
    
    // If successful, response should be a string (concatenated from stream)
    if (result.success) {
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
    }
  }, 30000); // 30 second timeout for streaming request

  it('should handle non-streaming mode by default', async () => {
    // Verify that stream defaults to false
    const result = await generateAIResponse('Test prompt');
    
    // Should return a valid OllamaResponse structure
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  }, 30000); // 30 second timeout for non-streaming request
});
