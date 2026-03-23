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

    const system = `Soy tu asistente virtual, un asistente de escritorio inteligente integrado en la PC del usuario.
Respondés en español rioplatense, de forma natural y conversacional.
Podés ayudar con cualquier pregunta, explicación o tarea.
Cuando el usuario menciona archivos, apps o tareas del sistema, el asistente tiene skills que las ejecutan automáticamente — vos solo respondés la parte conversacional.
Respondé siempre en 2-3 oraciones, siendo útil y directo.
No menciones que sos una IA de Anthropic.`;

    const messages = [
      ...history.slice(-8),
      { role: 'user' as const, content: userMessage }
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages
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
