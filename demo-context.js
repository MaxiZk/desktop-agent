/**
 * Demo script to show ContextBuilder in action
 * 
 * Run with: node demo-context.js
 */

import { ContextBuilder } from './src/core/context/ContextBuilder.js';

async function demo() {
  console.log('=== ContextBuilder Demo ===\n');

  // Create ContextBuilder instance
  const builder = new ContextBuilder({
    maxHistoryEntries: 10,
    maxContextSize: 8000,
    includeSystemInfo: true,
  });

  // Build context for a sample intent
  console.log('Building context for intent: "open_app"...\n');
  const context = await builder.buildContext('open_app', 'AppSkill');

  // Pretty print the context
  console.log(builder.prettyPrint(context));
  console.log('\n');

  // Show serialized format (what AI receives)
  console.log('=== Serialized for AI (first 800 chars) ===');
  const serialized = builder.serializeForAI(context);
  console.log(serialized.substring(0, 800) + '...\n');

  // Show how it would be injected into a prompt
  console.log('=== Example AI Prompt with Context ===');
  
  const recentCommands = context.commandHistory.slice(-3).map(cmd => 
    `- ${cmd.command} (${cmd.result})`
  ).join('\n');

  const contextInfo = recentCommands ? `\nContexto reciente:\n${recentCommands}\n` : '';

  const examplePrompt = `Analizá este mensaje y respondé SOLO con JSON válido:
${contextInfo}
Mensaje del usuario: "abrí chrome"

Skills disponibles (para acciones en la PC):
app: open_app, open_url, close_app, ...

Si el usuario quiere ejecutar una acción de las skills disponibles, respondé:
{
  "type": "action",
  "intent": "open_app",
  "params": { "appName": "chrome" },
  "response": "respuesta natural en español"
}`;

  console.log(examplePrompt);
  console.log('\n=== Demo Complete ===');
}

demo().catch(console.error);
