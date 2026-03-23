/**
 * NarratorService.ts — Natural language narration for skill results
 * 
 * Uses Claude (primary) and Ollama (fallback) to generate conversational responses in Spanish
 * after skill execution, making the assistant feel more human.
 */

import { askClaude } from '../../ai/claude_ai.js';
import { generateAIResponse } from '../../ai/ollama_ai.js';
import type { SkillResult } from '../Skill.js';

/**
 * Placeholder texts that indicate Ollama returned template text instead of actual response
 */
const PLACEHOLDER_TEXTS = [
  'respuesta conversacional en español',
  'tu respuesta en español',
];

/**
 * Check if text contains placeholder text from the prompt template
 */
function isPlaceholder(text: string): boolean {
  return PLACEHOLDER_TEXTS.some(p => text.toLowerCase().includes(p.toLowerCase()));
}

/**
 * Translate common English messages to Spanish for fallback
 */
function translateFallback(message: string): string {
  const translations: Record<string, string> = {
    'chrome opened successfully': 'Abrí Chrome',
    'notepad opened successfully': 'Abrí el Bloc de Notas',
    'calculator opened successfully': 'Abrí la Calculadora',
    'vscode opened successfully': 'Abrí VS Code',
    'steam opened successfully': 'Abrí Steam',
    'discord opened successfully': 'Abrí Discord',
    'notepad is already open': 'El Bloc de Notas ya estaba abierto',
    'chrome is already open': 'Chrome ya estaba abierto',
    'calculator is already open': 'La Calculadora ya estaba abierta',
    'PC locked successfully': 'Bloqueé la PC',
  }

  const lower = message.toLowerCase()
  for (const [key, value] of Object.entries(translations)) {
    if (lower.includes(key.toLowerCase())) {
      return value
    }
  }

  return message
}

/**
 * Generate a natural language narration for a skill execution result
 * 
 * @param result - The skill execution result
 * @returns Promise<string> - Narrated message (or original message if AI fails)
 */
export async function narrateResult(
  result: SkillResult
): Promise<string> {
  const startTime = Date.now();

  try {
    // Build prompt for AI
    const prompt = `En una oración natural en español, describí esta acción:
"${result.message}"

Terminá con una pregunta corta de seguimiento.`;

    // Try Claude first
    const claudeResult = await askClaude(prompt, []);
    
    if (claudeResult.success && claudeResult.response) {
      const elapsed = Date.now() - startTime;
      console.log(`[Narrator] Claude narrated in ${elapsed}ms`);
      return claudeResult.response;
    }
    
    console.log('[Narrator] Claude unavailable:', claudeResult.error);

    // Fallback to Ollama
    const ollamaPrompt = buildNarrationPrompt(result);

    // Call Ollama with 8 second timeout
    const ollamaResult = await Promise.race([
      generateAIResponse(ollamaPrompt, 'llama3.2:1b', false),
      timeoutPromise(8000)
    ]);

    // Check if timeout occurred
    if (ollamaResult === 'TIMEOUT') {
      console.log('[Narrator] Skipped (timeout after 8s)');
      return `${translateFallback(result.message)} ¿Necesitás algo más?`;
    }

    // Check if Ollama succeeded
    if (ollamaResult.success && ollamaResult.response) {
      const trimmed = ollamaResult.response.trim();
      
      // Check if response is invalid (JSON, placeholder, etc.)
      if (isInvalidResponse(trimmed)) {
        console.log('[Narrator] Invalid response detected, using fallback');
        return `${translateFallback(result.message)} ¿Necesitás algo más?`;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[Narrator] Ollama narrated in ${elapsed}ms`);
      return `${result.message}. ¿${trimmed}`;
    }

    // Ollama failed, use fallback
    console.log(`[Narrator] Skipped (Ollama unavailable: ${ollamaResult.error})`);
    return `${translateFallback(result.message)} ¿Necesitás algo más?`;

  } catch (error) {
    // Graceful fallback on any error
    console.log(`[Narrator] Skipped (error: ${error instanceof Error ? error.message : 'unknown'})`);
    return `${translateFallback(result.message)} ¿Necesitás algo más?`;
  }
}

/**
 * Check if response looks like JSON or contains invalid characters
 */
function isInvalidResponse(text: string): boolean {
  // Check for JSON-like patterns
  if (text.includes('{') || text.includes('}') || text.includes('"')) {
    return true;
  }
  // Check for placeholder text
  if (isPlaceholder(text)) {
    return true;
  }
  return false;
}

/**
 * Build the narration prompt for Ollama
 */
function buildNarrationPrompt(result: SkillResult): string {
  return `Completá esta frase en español, máximo 8 palabras:
"${result.message}. ¿"`;
}

/**
 * Create a promise that rejects after a timeout
 */
function timeoutPromise(ms: number): Promise<'TIMEOUT'> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('TIMEOUT'), ms);
  });
}
