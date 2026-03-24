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
import type { SkillResult } from '../Skill.js';
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
 * @param fileContext - Optional file context for conversational editing
 * @param prefsContext - Optional user preferences context
 * @returns Promise<SkillResult> - Result with AI's response or skill execution
 */
export async function handleFreeForm(
  userMessage: string,
  registry: SkillRegistry,
  contextBuilder?: ContextBuilder,
  conversationHistory?: ConversationMessage[],
  fileContext?: { filePath: string; fileType: string },
  prefsContext?: string
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

    // Add file context if provided
    let fileContextInfo = '';
    let fileContextPath = '';
    if (fileContext) {
      fileContextPath = fileContext.filePath;
      fileContextInfo = `
⚠️ ARCHIVO ACTIVO: ${fileContext.filePath}

INSTRUCCIÓN OBLIGATORIA: El usuario está trabajando con este archivo.
Si pide agregar, modificar, abrir, revisar o hacer CUALQUIER acción
sobre este archivo, DEBES retornar type "action", NO type "chat".
NUNCA respondas con chat cuando hay un archivo activo y el usuario
pide hacer algo con él.
`;
      contextInfo += fileContextInfo;
    }

    // Add user preferences context if provided
    if (prefsContext) {
      contextInfo += `\n${prefsContext}\n`;
    }

    // Format conversation history
    let historyText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyText = '\nHistorial de conversación:\n' + 
        conversationHistory.map(h => 
          `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`
        ).join('\n') + '\n';
    }

    // Build list of available skills with detailed descriptions
    const skillDescriptions = `
Skills disponibles (para acciones en la PC):
- open_app: abrir aplicaciones - params: { appName }
- open_url: abrir URL o sitio web - params: { url }
- close_app: cerrar aplicación - params: { appName }
- focus_app: enfocar aplicación - params: { appName }
- minimize_app: minimizar aplicación - params: { appName }
- list_running_apps: listar apps en ejecución - no params
- search_files: buscar archivos por nombre - params: { query }
- move_file: mover o cortar/pegar archivo - params: { source, destination }
- search_folder: buscar carpeta por nombre - params: { query }
- read_file: leer contenido de archivo - params: { filePath }
- open_file: abrir archivo con programa predeterminado - params: { filePath }
- open_folder: abrir carpeta en explorador - params: { filePath }
- analyze_csv: analizar archivo CSV - params: { filePath }
- file_create: crear Excel/Word/TXT - params: { filePath }
- excel_edit: abrir Excel conversacionalmente - params: { filePath }
- txt_edit: abrir TXT conversacionalmente - params: { filePath }
- word_edit: abrir Word conversacionalmente - params: { filePath }
- excel_read: leer Excel - params: { filePath }
- excel_create: crear Excel - params: { filePath, data, headers }
- excel_append_row: agregar fila a Excel - params: { filePath, content }
- text_append: agregar texto al final - params: { filePath, content }
- text_prepend: agregar texto al principio - params: { filePath, content }
- text_replace: reemplazar texto - params: { filePath, search, replacement }
- text_delete: eliminar línea - params: { filePath, phrase }
- system_lock: bloquear PC - no params
- system_shutdown: apagar PC - no params (requiere confirmación)
- system_restart: reiniciar PC - no params (requiere confirmación)
- system_sleep: suspender PC - no params
- clear_history: limpiar historial de conversación - no params
`;

    // Detect language for explicit instruction - improved scoring
    const spanishScore = (userMessage.match(/\b(el|la|los|las|que|por|para|con|es|son|podes|podés|hola|soy|me|mi|tu|le|se|del|al|un|una|pero|esto|ese|eso|también|tambien|ahora|después|despues|cuando|como|donde|qué|que)\b/gi) || []).length;
    const englishScore = (userMessage.match(/\b(the|is|are|was|were|have|has|can|could|would|should|will|this|that|these|those|and|but|for|with|from|your|you|open|close|add|create|show|find|please|help|me|my)\b/gi) || []).length;
    const isSpanish = spanishScore >= englishScore;
    const langInstruction = isSpanish 
      ? 'IMPORTANTE: El usuario escribió en español. Respondé SOLO en español rioplatense. NO respondas en inglés bajo ninguna circunstancia.'
      : 'IMPORTANT: The user wrote in English. Respond ONLY in English. Do NOT respond in Spanish under any circumstance.';

    // Build prompt for AI
    const prompt = `${langInstruction}

Analizá este mensaje y respondé SOLO con JSON válido:
${contextInfo}${historyText}
Mensaje actual del usuario: "${userMessage}"

${skillDescriptions}

IDIOMA: Detectá el idioma del mensaje del usuario y respondé en ESE MISMO idioma.
- Si el usuario escribe en español → respondé en español rioplatense
- Si el usuario escribe en inglés → respondé en inglés
- Si el usuario escribe en otro idioma → respondé en ese idioma
SIEMPRE igualá el idioma del usuario.

REGLA IMPORTANTE: Si el usuario pide modificar, llenar, editar,
agregar o cambiar un archivo específico (Excel, TXT, Word),
SIEMPRE respondé con type "action", NUNCA con type "chat".
No digas que lo hiciste si no ejecutaste la acción.

EJEMPLOS DE ACCIONES (usar ruta absoluta del archivo activo):
${fileContextPath ? `Archivo activo: ${fileContextPath}` : ''}
- "llenalo con autos" → {"type":"action","intent":"excel_append_row","params":{"filePath":"${fileContextPath || '/ruta/archivo.xlsx'}","rows":"Toyota Corolla,25000,12\\nFord Focus,18000,18\\nHonda Civic,22000,24"},"response":"Agregando modelos..."}
- "agregá en columna A modelos..." → {"type":"action","intent":"excel_append_row","params":{"filePath":"${fileContextPath || '/ruta/archivo.xlsx'}","content":"Modelo A,Modelo B,Modelo C"},"response":"Agregando..."}
- "escribí en el txt..." → {"type":"action","intent":"text_append","params":{"filePath":"${fileContextPath || '/ruta/archivo.txt'}","content":"texto a agregar"},"response":"Escribiendo..."}

Si el usuario quiere ejecutar una acción de las skills disponibles, respondé:
{
  "type": "action",
  "intent": "nombre_intent",
  "params": { "clave": "valor" },
  "response": "respuesta natural en el idioma del usuario"
}

Si es conversación, pregunta o cualquier otra cosa, respondé:
{
  "type": "chat",
  "response": "tu respuesta en el idioma del usuario, 2-3 oraciones"
}

IMPORTANTE: Respondé ÚNICAMENTE con el JSON. Sin texto adicional.`;

    // Try Claude first with 8-second timeout
    const claudeResult = await Promise.race([
      askClaude(prompt, []),
      timeoutPromise(8000),
    ]);
    
    // Check if timeout occurred
    if (claudeResult === 'TIMEOUT') {
      console.log('[FreeForm] Claude timeout after 8s, falling back to Ollama');
    } else if (claudeResult.success && claudeResult.response) {
      try {
        // Clean up response (remove markdown code blocks if present)
        const clean = claudeResult.response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        // Validate response is not empty or too short
        if (clean.length < 10) {
          console.log('[FreeForm] Claude response too short, retrying with simpler prompt');
          
          // Retry with simpler prompt
          const simplePrompt = `Usuario: "${userMessage}"\n\nDetectá el idioma del usuario y respondé en ese mismo idioma. Máximo 3 oraciones.`;
          const retryResult = await Promise.race([
            askClaude(simplePrompt, []),
            timeoutPromise(5000),
          ]);
          
          if (retryResult !== 'TIMEOUT' && retryResult.success && retryResult.response && retryResult.response.length >= 10) {
            const elapsed = Date.now() - startTime;
            console.log(`[FreeForm] Claude retry processed in ${elapsed}ms`);
            
            return {
              success: true,
              message: retryResult.response,
            };
          }
        } else {
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
          if (parsed.type === 'chat' && parsed.response && parsed.response.length >= 10) {
            const elapsed = Date.now() - startTime;
            console.log(`[FreeForm] Claude chat processed in ${elapsed}ms`);
            
            return {
              success: true,
              message: parsed.response,
            };
          }
        }
      } catch (parseError) {
        console.log('[FreeForm] Claude JSON parse error, falling back to Ollama');
      }
    } else {
      console.log('[FreeForm] Claude unavailable:', claudeResult.error);
    }

    // Fallback to Ollama
    const spanishScoreOllama = (userMessage.match(/\b(el|la|los|las|que|por|para|con|es|son|podes|podés|hola|soy|me|mi|tu|le|se|del|al|un|una|pero|esto|ese|eso|también|tambien|ahora|después|despues|cuando|como|donde|qué|que)\b/gi) || []).length;
    const englishScoreOllama = (userMessage.match(/\b(the|is|are|was|were|have|has|can|could|would|should|will|this|that|these|those|and|but|for|with|from|your|you|open|close|add|create|show|find|please|help|me|my)\b/gi) || []).length;
    const isSpanishOllama = spanishScoreOllama >= englishScoreOllama;
    const langInstructionOllama = isSpanishOllama 
      ? 'IMPORTANTE: El usuario escribió en español. Respondé SOLO en español rioplatense. NO respondas en inglés bajo ninguna circunstancia.'
      : 'IMPORTANT: The user wrote in English. Respond ONLY in English. Do NOT respond in Spanish under any circumstance.';
    
    const detectedLang = isSpanishOllama ? 'español rioplatense' : 'English';
    
    const ollamaPrompt = `${langInstructionOllama}

Soy tu asistente virtual, un asistente de escritorio inteligente.
${contextInfo}${historyText}
${skillDescriptions}

El usuario escribió: "${userMessage}"

IDIOMA: Detectá el idioma del mensaje del usuario y respondé en ESE MISMO idioma.
- Si el usuario escribe en español → respondé en español rioplatense
- Si el usuario escribe en inglés → respondé en inglés
- Si el usuario escribe en otro idioma → respondé en ese idioma
Respondé en ${detectedLang}.

Analizá si el usuario quiere ejecutar una acción o solo conversar.

Si quiere ejecutar una acción, respondé SOLO con este JSON:
{
  "type": "action",
  "intent": "nombre_del_intent",
  "params": { "clave": "valor" },
  "response": "respuesta conversacional en el idioma del usuario"
}

Si es conversación, respondé SOLO con este JSON:
{
  "type": "chat",
  "response": "tu respuesta en el idioma del usuario, máximo 3 oraciones"
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
