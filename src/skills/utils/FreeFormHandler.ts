/**
 * FreeFormHandler.ts — Free-form chat using Claude (primary) and Ollama (fallback)
 * 
 * When CommandRouter returns "unknown", this handler uses Claude to:
 * 1. Determine if the user wants to execute a skill or just chat
 * 2. Extract intent and params if it's a skill command
 * 3. Respond naturally if it's just conversation
 */

import { askClaude } from '../../ai/claude_ai.js';
import { generateAIResponse } from '../../ai/ollama_ai.js';
import { ContextBuilder } from '../../core/context/ContextBuilder.js';
import type { Skill, SkillResult } from '../Skill.js';
import type { SkillRegistry } from '../SkillRegistry.js';

interface OllamaActionResponse {
  type: 'action';
  intent: string;
  params: Record<string, unknown>;
  response: string;
}

interface OllamaChatResponse {
  type: 'chat';
  response: string;
}

type OllamaResponse = OllamaActionResponse | OllamaChatResponse;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Placeholder texts that indicate Ollama returned template text instead of actual response
 */
const PLACEHOLDER_TEXTS = [
  'respuesta conversacional en español',
  'tu respuesta en español',
  'nombre_del_intent',
];

/**
 * Check if text contains placeholder text from the prompt template
 */
function isPlaceholder(text: string): boolean {
  return PLACEHOLDER_TEXTS.some(p => text.toLowerCase().includes(p.toLowerCase()));
}

/**
 * Handle free-form user input using Claude (primary) and Ollama (fallback)
 * 
 * @param userMessage - The user's message
 * @param registry - The skill registry to access available skills
 * @param contextBuilder - Optional ContextBuilder for enriched prompts
 * @param conversationHistory - Optional conversation history for context
 * @returns Promise<SkillResult> - Result with AI's response or skill execution
 */
export async function handleFreeForm(
  userMessage: string,
  registry: SkillRegistry,
  contextBuilder?: ContextBuilder,
  conversationHistory?: ConversationMessage[]
): Promise<SkillResult> {
  const startTime = Date.now();

  try {
    // Build context if ContextBuilder is provided
    let contextInfo = '';
    if (contextBuilder) {
      try {
        const context = await contextBuilder.buildContext('free_form', 'FreeFormHandler');
        
        // Format context for AI prompt (compact format)
        const recentCommands = context.commandHistory.slice(-3).map(cmd => 
          `- ${cmd.command} (${cmd.result})`
        ).join('\n');
        
        if (recentCommands) {
          contextInfo = `\nContexto reciente:\n${recentCommands}\n`;
        }
      } catch (error) {
        console.warn('[FreeForm] Failed to build context:', error);
        // Continue without context
      }
    }

    // Format conversation history
    let historyText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyText = '\nHistorial de conversación:\n' + 
        conversationHistory.map(h => 
          `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`
        ).join('\n') + '\n';
    }

    // Build list of available skills
    const availableSkills = registry.getAll()
      .map((s: Skill) => `${s.name}: ${s.supportedIntents.join(', ')}`)
      .join('\n');

    // Build prompt for AI
    const prompt = `Analizá este mensaje y respondé SOLO con JSON válido:
${contextInfo}${historyText}
Mensaje actual del usuario: "${userMessage}"

Skills disponibles (para acciones en la PC):
${availableSkills}

Si el usuario quiere ejecutar una acción de las skills disponibles, respondé:
{
  "type": "action",
  "intent": "nombre_intent",
  "params": { "clave": "valor" },
  "response": "respuesta natural en español"
}

Si es conversación, pregunta o cualquier otra cosa, respondé:
{
  "type": "chat",
  "response": "tu respuesta en español, 2-3 oraciones"
}

IMPORTANTE: Respondé ÚNICAMENTE con el JSON. Sin texto adicional.`;

    // Try Claude first
    const claudeResult = await askClaude(prompt, []);
    
    if (claudeResult.success && claudeResult.response) {
      try {
        // Clean up response (remove markdown code blocks if present)
        const clean = claudeResult.response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        const parsed = JSON.parse(clean);
        
        // Handle action type
        if (parsed.type === 'action' && parsed.intent && parsed.intent !== 'unknown') {
          const skill = registry.resolve(parsed.intent);
          if (skill) {
            const result = await skill.execute({
              rawCommand: userMessage,
              intent: parsed.intent,
              params: parsed.params ?? {},
              confirmed: false,
            });
            
            const elapsed = Date.now() - startTime;
            console.log(`[FreeForm] Claude action processed in ${elapsed}ms - Intent: ${parsed.intent}`);
            
            return {
              ...result,
              message: parsed.response ?? result.message,
            };
          }
        }
        
        // Handle chat type
        if (parsed.type === 'chat' && parsed.response) {
          const elapsed = Date.now() - startTime;
          console.log(`[FreeForm] Claude chat processed in ${elapsed}ms`);
          
          return {
            success: true,
            message: parsed.response,
          };
        }
      } catch (parseError) {
        console.log('[FreeForm] Claude JSON parse error, falling back to Ollama');
      }
    } else {
      console.log('[FreeForm] Claude unavailable:', claudeResult.error);
    }

    // Fallback to Ollama
    const ollamaPrompt = `Soy tu asistente virtual, un asistente de escritorio inteligente.
${contextInfo}${historyText}
Tenés acceso a estas skills:
${availableSkills}

El usuario escribió: "${userMessage}"

Analizá si el usuario quiere ejecutar una acción o solo conversar.

Si quiere ejecutar una acción, respondé SOLO con este JSON:
{
  "type": "action",
  "intent": "nombre_del_intent",
  "params": { "clave": "valor" },
  "response": "respuesta conversacional en español"
}

Si es conversación, respondé SOLO con este JSON:
{
  "type": "chat",
  "response": "tu respuesta en español, máximo 3 oraciones"
}

Respondé ÚNICAMENTE con el JSON, sin texto adicional.`;

    // Call Ollama with 15 second timeout
    const ollamaResult = await Promise.race([
      generateAIResponse(ollamaPrompt, 'llama3.2:1b', false),
      timeoutPromise(15000),
    ]);

    // Check if timeout occurred
    if (ollamaResult === 'TIMEOUT') {
      console.log('[FreeForm] Timeout after 15s');
      return {
        success: false,
        message: 'No pude procesar eso a tiempo. ¿Podés intentar de nuevo?',
      };
    }

    // Check if Ollama failed
    if (!ollamaResult.success || !ollamaResult.response) {
      console.log('[FreeForm] Ollama unavailable:', ollamaResult.error);
      return {
        success: false,
        message: 'No pude entender eso. ¿Podés ser más específico?',
      };
    }

    // Parse JSON response
    const parsed = parseOllamaResponse(ollamaResult.response);
    
    if (!parsed) {
      console.log('[FreeForm] Invalid JSON from Ollama');
      return {
        success: false,
        message: 'No pude entender eso. ¿Podés ser más específico?',
      };
    }

    const elapsed = Date.now() - startTime;
    console.log(`[FreeForm] Ollama processed in ${elapsed}ms - Type: ${parsed.type}`);

    // Handle action type
    if (parsed.type === 'action') {
      // Check if response contains placeholder text
      if (isPlaceholder(parsed.response)) {
        console.log('[FreeForm] Placeholder detected in action response');
        return await handleAction({ ...parsed, response: '' }, registry);
      }
      return await handleAction(parsed, registry);
    }

    // Handle chat type
    if (parsed.type === 'chat') {
      // Check if response contains placeholder text
      if (isPlaceholder(parsed.response)) {
        console.log('[FreeForm] Placeholder detected in chat response');
        return {
          success: true,
          message: '¿En qué más te puedo ayudar?',
        };
      }
      return {
        success: true,
        message: parsed.response,
      };
    }

    // Unknown type
    return {
      success: false,
      message: 'No pude entender eso. ¿Podés ser más específico?',
    };

  } catch (error) {
    console.error('[FreeForm] Error:', error instanceof Error ? error.message : 'unknown');
    return {
      success: false,
      message: 'No pude entender eso. ¿Podés ser más específico?',
    };
  }
}

/**
 * Parse Ollama's JSON response
 */
function parseOllamaResponse(response: string): OllamaResponse | null {
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.type) {
      return null;
    }

    if (parsed.type === 'action') {
      if (!parsed.intent || !parsed.params || !parsed.response) {
        return null;
      }
      return parsed as OllamaActionResponse;
    }

    if (parsed.type === 'chat') {
      if (!parsed.response) {
        return null;
      }
      return parsed as OllamaChatResponse;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Handle action type response
 */
async function handleAction(
  action: OllamaActionResponse,
  registry: SkillRegistry
): Promise<SkillResult> {
  try {
    // Find the skill
    const skill = registry.resolve(action.intent);

    if (!skill) {
      console.log(`[FreeForm] Skill not found for intent: ${action.intent}`);
      // Fallback to chat response
      return {
        success: true,
        message: action.response,
      };
    }

    // Build context
    const context = {
      rawCommand: '',
      intent: action.intent,
      params: action.params,
      confirmed: false,
    };

    // Validate params
    const validationError = skill.validate(context);
    if (validationError) {
      console.log(`[FreeForm] Validation error: ${validationError}`);
      return {
        success: false,
        message: validationError,
      };
    }

    // Execute skill
    const result = await skill.execute(context);

    // Replace message with Ollama's conversational response (if not empty/placeholder)
    if (action.response && !isPlaceholder(action.response)) {
      return {
        ...result,
        message: action.response,
      };
    }
    
    // Use generic message if response is empty or placeholder
    return {
      ...result,
      message: result.success ? `${result.message} ¿Necesitás algo más?` : result.message,
    };

  } catch (error) {
    console.error('[FreeForm] Action execution error:', error);
    return {
      success: false,
      message: action.response, // Use Ollama's response as fallback
    };
  }
}

/**
 * Create a promise that resolves after a timeout
 */
function timeoutPromise(ms: number): Promise<'TIMEOUT'> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('TIMEOUT'), ms);
  });
}
