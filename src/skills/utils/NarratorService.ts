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
 * Detect language from text
 */
function detectLanguage(text: string): string {
  if (!text) return 'Spanish (rioplatense)';
  
  const spanishWords = /\b(el|la|los|las|un|una|que|por|para|con|del|al|es|son|tiene|puede|quiero|necesito|podes|podés|hola|soy|abrí|cerrá|buscá|crea|dale|listo|gracias|por favor|ahora|después|antes|cuando|como|donde|esto|ese|esa)\b/gi;
  const englishWords = /\b(the|is|are|was|were|have|has|can|could|would|should|will|this|that|open|close|find|create|show|please|thanks|now|after|before|when|how|where)\b/gi;
  
  const spanishScore = (text.match(spanishWords) || []).length;
  const englishScore = (text.match(englishWords) || []).length;
  
  // Default to Spanish unless clearly more English words
  return englishScore > spanishScore ? 'English' : 'Spanish (rioplatense)';
}

/**
 * Generate a natural language narration for a skill execution result
 * 
 * @param result - The skill execution result
 * @param userMessage - Optional user message for language detection
 * @returns Promise<string> - Narrated message (or original message if AI fails)
 */
export async function narrateResult(
  result: SkillResult,
  userMessage?: string
): Promise<string> {
  const startTime = Date.now();

  try {
    // Detect language from user message or result message
    const detectedLang = detectLanguage(userMessage || result.message);
    const isSpanish = /\b(el|la|los|las|que|por|para|con|es|son|podes|podés|hola|soy|me|mi|tu|le|se)\b/i.test(userMessage || result.message);
    const langInstruction = isSpanish 
      ? 'IMPORTANTE: El usuario escribió en español. Respondé SOLO en español rioplatense.'
      : 'IMPORTANT: The user wrote in English. Respond ONLY in English.';
    
    // Build prompt for AI
    const prompt = `${langInstruction}

The user's message was in ${detectedLang} language.
Respond in that same language. In 1-2 natural sentences, describe this action:
"${result.message}"

End with a short follow-up question.`;

    // Try Claude first
    const claudeResult = await askClaude(prompt, []);
    
    if (claudeResult.success && claudeResult.response) {
      const elapsed = Date.now() - startTime;
      console.log(`[Narrator] Claude narrated in ${elapsed}ms`);
      return claudeResult.response;
    }
    
    console.log('[Narrator] Claude unavailable:', claudeResult.error);

    // Fallback to Ollama
    const isSpanishOllama = /\b(el|la|los|las|que|por|para|con|es|son|podes|podés|hola|soy|me|mi|tu|le|se)\b/i.test(userMessage || result.message);
    const langInstructionOllama = isSpanishOllama 
      ? 'IMPORTANTE: El usuario escribió en español. Respondé SOLO en español rioplatense.'
      : 'IMPORTANT: The user wrote in English. Respond ONLY in English.';
    
    const detectedLangSimple = isSpanishOllama ? 'español rioplatense' : 'English';
    const ollamaPrompt = buildNarrationPrompt(result, detectedLangSimple, langInstructionOllama);

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
function buildNarrationPrompt(result: SkillResult, language: string, langInstruction: string): string {
  return `${langInstruction}

Completá esta frase en ${language}, máximo 8 palabras:
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
