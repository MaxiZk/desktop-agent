import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export async function askClaude(
  userMessage: string,
  history: ClaudeMessage[] = []
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log('[Claude] Falling back - no API key');
    return { success: false, error: 'ANTHROPIC_API_KEY not set' };
  }

  // Create client lazily so it picks up the env var after dotenv loads
  const client = new Anthropic({ apiKey });

  try {
    console.log('[Claude] Making request...');

    // Detect language from the last user message with scoring
    const lastUserMsg = history.length > 0 ? history[history.length - 1].content : userMessage;
    const spanishScore = (lastUserMsg.match(/\b(el|la|que|por|para|con|es|podes|hola|soy|abrí|dale|listo)\b/gi) || []).length;
    const englishScore = (lastUserMsg.match(/\b(the|is|are|can|open|close|this|that|please|thanks)\b/gi) || []).length;
    const langRule = spanishScore >= englishScore
      ? 'You MUST respond in Spanish (rioplatense). Never respond in English.'
      : 'You MUST respond in English. Never respond in Spanish.';

    const system = `${langRule}

You are a smart desktop assistant.

CRITICAL LANGUAGE RULE:
- Analyze the language of EACH user message independently
- If the message contains Spanish words → respond in Spanish (rioplatense)
- If the message is in English → respond in English
- If mixed → use the dominant language
- NEVER respond in a different language than what the user wrote
- This rule overrides everything else

Respondés de forma natural y conversacional.
Podés ayudar con cualquier pregunta, explicación o tarea.
Cuando el usuario menciona archivos, apps o tareas del sistema, el asistente tiene skills que las ejecutan automáticamente — vos solo respondés la parte conversacional.
Respondé siempre en 2-3 oraciones, siendo útil y directo.
No menciones que sos una IA de Anthropic.`;

    // Detect language with scoring for message prefix
    const spanishScoreMsg = (userMessage.match(/\b(el|la|los|las|que|por|para|con|es|son|podes|podés|hola|soy|me|mi|tu|le|se|del|al|un|una|pero|esto|ese|eso|también|tambien|ahora|después|despues|cuando|como|donde|qué|que)\b/gi) || []).length;
    const englishScoreMsg = (userMessage.match(/\b(the|is|are|was|were|have|has|can|could|would|should|will|this|that|these|those|and|but|for|with|from|your|you|open|close|add|create|show|find|please|help|me|my)\b/gi) || []).length;
    const isSpanish = spanishScoreMsg >= englishScoreMsg;
    const langPrefix = isSpanish ? '[RESPOND IN SPANISH ONLY] ' : '[RESPOND IN ENGLISH ONLY] ';

    const messagesWithLang = [
      ...history.slice(-8),
      { role: 'user' as const, content: langPrefix + userMessage }
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages: messagesWithLang
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    return { success: true, response: text };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Claude] Request failed:', errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}
