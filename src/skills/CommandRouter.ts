/**
 * CommandRouter.ts — Parser de lenguaje natural
 *
 * Convierte el texto libre del usuario en un intent estructurado
 * con parámetros. Soporta español e inglés.
 *
 * Arquitectura preparada para reemplazar las reglas por un LLM
 * (Ollama) sin cambiar la interfaz pública.
 */

import type { SkillContext } from './Skill.js';

export interface ParseResult {
  intent: string;
  params: Record<string, unknown>;
  confidence: number;
  method: 'rules' | 'llm';
}

// ---------------------------------------------------------------------------
// Tabla de reglas: cada entrada define patrones para un intent
// IMPORTANTE: Los patrones más específicos deben ir primero
// ---------------------------------------------------------------------------

interface IntentRule {
  intent: string;
  patterns: RegExp[];
  extractParams?: (text: string, match: RegExpMatchArray) => Record<string, unknown>;
}

const RULES: IntentRule[] = [
  // --- Append row to Excel (HIGHEST PRIORITY) ---
  {
    intent: 'excel_append_row',
    patterns: [
      /(?:agregá?|add|insertá?)\s+(?:una?\s+)?(?:fila|row|datos?)\s+(?:en|a)\s+(.+?\.(xlsx?|csv))\s+con[:]?\s*(.+)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1]?.trim(),
      content: match[3]?.trim(),
    }),
  },
  {
    intent: 'excel_create_summary_sheet',
    patterns: [
      /(?:creá?|generá?)\s+(?:una?\s+)?hoja\s+(?:de\s+)?resumen\s+(?:en|de)\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1]?.trim(),
    }),
  },

  // --- File creation (HIGHEST PRIORITY) ---
  {
    intent: 'file_create',
    patterns: [
      /(?:creá?|crear?|create|generá?|make|hacé?)\s+(?:un?\s+)?(?:archivo\s+)?(?:excel|xlsx?|word|docx?|txt|texto)\s+(?:llamad[oa]\s+)?(.+?\.(xlsx?|csv|docx?|txt))\s+en\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: `${match[3].trim()}/${match[1].trim()}`
    }),
  },
  {
    intent: 'file_create',
    patterns: [
      /(?:creá?|crear?|create|generá?|make|hacé?)\s+(?:un?\s+)?(?:archivo\s+de\s+)?(?:excel|xlsx?|word|docx?|txt|texto)\s+(?:llamad[oa]\s+)?(.+)/i,
    ],
    extractParams: (text, match) => ({
      filePath: match[1]?.trim(),
      rawText: text
    }),
  },

  // --- File paths (HIGHEST PRIORITY - must be first) ---
  {
    intent: 'open_file',
    patterns: [
      /^(?:abrí?|abrir?|open)\s+archivo\s+(.+)$/i,
      /^(?:abrí?|abrir?|open)\s+([A-Za-z]:\\.+)$/i,
      /^([A-Za-z]:\\.+\.\w+)$/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1]?.trim() }),
  },

  // --- Excel / CSV (más específicos primero) ---
  {
    intent: 'excel_create',
    patterns: [
      /(?:creá?|crear?|create|generá?|generar?|hacer?|hacé?|make)\s+(?:un?\s+)?(?:archivo\s+)?(?:excel|xlsx?)\s+(?:en\s+|en\s+la\s+carpeta\s+)?(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1]?.trim() }),
  },
  {
    intent: 'excel_read',
    patterns: [
      /le[eé]\s+(?:el\s+)?(?:excel|xlsx)\s+(.+)/i,
      /abr[ií]\s+(?:el\s+)?(?:excel|xlsx)\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },
  {
    intent: 'excel_summary',
    patterns: [
      /resumen\s+(?:mensual\s+)?(?:de[l]?\s+(?:archivo\s+)?)?(.+)/i,
      /summary\s+(?:of\s+)?(.+)/i,
      /generá?\s+(?:un\s+)?resumen\s+(?:de[l]?\s+)?(.+)/i,
      /totales?\s+(?:de[l]?\s+)?(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },
  {
    intent: 'excel_duplicates',
    patterns: [
      /duplic[aá]dos?\s+(?:por\s+(\w+)\s+en\s+)?(.+)/i,
      /detect[aá]\s+duplic[aá]dos?\s+(?:por\s+(\w+)\s+en\s+)?(.+)/i,
    ],
    extractParams: (_text, match) => ({
      column: match[1]?.trim() ?? null,
      filePath: match[2]?.trim() ?? match[1]?.trim(),
    }),
  },
  {
    intent: 'csv_to_excel',
    patterns: [
      /convert[ií]\s+(.+\.csv)\s+(?:a|to)\s+(?:excel|xlsx)/i,
      /pas[aá]\s+(.+\.csv)\s+a\s+(?:excel|xlsx)/i,
      /transform[aá]\s+(.+\.csv)\s+(?:a|to)\s+(?:excel|xlsx)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },

  // --- Sistema (específicos antes de apps) ---
  {
    intent: 'system_lock',
    patterns: [
      /^bloque[aá]\s*(?:la|el|mi)?\s*pc\s*$/i,
      /^lock\s*(?:the\s+)?pc\s*$/i,
      /^bloque[aá]\s*$/i,
      /^lock\s*$/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'system_shutdown',
    patterns: [
      /^apag[aá]\s*(?:la|el|mi)?\s*pc\s*$/i,
      /^shutdown\s*(?:the\s+)?pc\s*$/i,
      /^apag[aá]\s*$/i,
      /^shutdown\s*$/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'system_restart',
    patterns: [
      /^reinici[aá]\s*(?:la|el|mi)?\s*pc\s*$/i,
      /^restart\s*(?:the\s+)?pc\s*$/i,
      /^reinici[aá]\s*$/i,
      /^restart\s*$/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'system_sleep',
    patterns: [
      /^suspend[eé]\s*(?:la|el|mi)?\s*pc\s*$/i,
      /^sleep\s*(?:the\s+)?pc\s*$/i,
      /^dorm[ií]\s*(?:la|el|mi)?\s*pc\s*$/i,
      /^suspend[eé]\s*$/i,
      /^sleep\s*$/i,
      /^dorm[ií]\s*$/i,
    ],
    extractParams: () => ({}),
  },

  // --- Edición de texto ---
  {
    intent: 'text_append',
    patterns: [
      /(?:agregá|agregar?|add|escribí|escribir?|añadí|añadir?)\s+(?:al?\s+)?(?:final\s+de\s+|end\s+of\s+)(.+?):\s*(.+)/i,
      /(?:agregá|agregar?|add)\s+(?:en|in|a)\s+(.+?):\s*(.+)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1].trim(),
      content: match[2].trim(),
    }),
  },
  {
    intent: 'text_prepend',
    patterns: [
      /(?:agregá|agregar?|add|escribí|escribir?)\s+(?:al?\s+)?(?:principio\s+de\s+|inicio\s+de\s+|start\s+of\s+)(.+?):\s*(.+)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1].trim(),
      content: match[2].trim(),
    }),
  },
  {
    intent: 'text_replace',
    patterns: [
      /(?:reemplazá|reemplazar?|replace|cambiá|cambiar?)\s+"(.+?)"\s+(?:por|with|con)\s+"(.+?)"\s+(?:de|from|en|in)\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({
      search: match[1].trim(),
      replacement: match[2].trim(),
      filePath: match[3].trim(),
    }),
  },
  {
    intent: 'text_delete',
    patterns: [
      /(?:eliminá|eliminar?|borrá|borrar?|delete|remove)\s+(?:la\s+l[ií]nea\s+(?:que\s+dice\s+)?|line\s+)?"(.+?)"\s+(?:de|from|en|in)\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({
      phrase: match[1].trim(),
      filePath: match[2].trim(),
    }),
  },

  // --- Conversational editing - direct file paths (before specific file operations) ---
  {
    intent: 'excel_edit',
    patterns: [
      /(?:trabajá?|editá?|modific[aá]?|abrí?\s+y\s+editar?)\s+(.+\.(xlsx?|csv))/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1]?.trim(),
    }),
  },
  {
    intent: 'txt_edit',
    patterns: [
      /(?:trabajá?|editá?|modific[aá]?)\s+(.+\.txt)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1]?.trim(),
    }),
  },
  {
    intent: 'word_edit',
    patterns: [
      /(?:trabajá?|editá?|modific[aá]?)\s+(.+\.docx?)/i,
    ],
    extractParams: (_text, match) => ({
      filePath: match[1]?.trim(),
    }),
  },

  // --- Archivos (específicos) - MUST come before open_app ---
  {
    intent: 'search_files',
    patterns: [
      /busc[aá]\s+(?:el\s+)?archivo\s+(.+)/i,
      /find\s+(?:file\s+)?(.+)/i,
      /encontr[aá]\s+(?:el\s+)?archivo\s+(.+)/i,
      /d[oó]nde\s+(?:est[aá]|tengo)\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({ query: match[1].trim() }),
  },
  {
    intent: 'open_folder',
    patterns: [
      /abr[ií]\s+(?:la\s+)?carpeta\s+(?:de\s+)?(.+)/i,
      /open\s+folder\s+(.+)/i,
      /mostr[aá]\s+(?:la\s+)?carpeta\s+(?:de\s+)?(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },
  {
    intent: 'analyze_csv',
    patterns: [
      /analiz[aá]\s+(?:el\s+)?csv\s+(.+)/i,
      /analyze\s+csv\s+(.+)/i,
      /procesa\s+(?:el\s+)?csv\s+(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },
  {
    intent: 'read_file',
    patterns: [
      /(?:le[eé]|mostráme)\s+(?:el\s+)?(?:archivo\s+)?(.+)/i,
      /read\s+(?:file\s+)?(.+)/i,
    ],
    extractParams: (_text, match) => ({ filePath: match[1].trim() }),
  },

  // --- Apps (más generales, al final) ---
  {
    intent: 'open_url',
    patterns: [
      /(?:abrí?|abrir?|open)\s+(?:una?\s+)?(?:pesta[nñ]a\s+(?:nueva\s+)?(?:de|en|con)\s+)?(?:chrome\s+)?(?:con\s+)?(?:la\s+p[aá]gina\s+)?(.+\.(?:com|org|net|ar|io|ai|dev|co|app)|https?:\/\/.+)/i,
      /(?:abrí?|abrir?|open)\s+(?:la\s+p[aá]gina\s+|el\s+sitio\s+)?(.+\.(?:com|org|net|ar|io|ai|dev|co|app))/i,
    ],
    extractParams: (_text, match) => ({ url: match[1]?.trim() }),
  },
  {
    intent: 'list_running_apps',
    patterns: [
      /list(?:ar?)?\s+(?:running\s+)?apps?/i,
      /list(?:ar?)?\s+(?:aplicaciones|apps)\s+(?:abiertas|en\s+ejecuci[oó]n)/i,
      /qu[eé]\s+apps?\s+(?:est[aá]n|tengo)\s+(?:abiertas|corriendo)/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'focus_app',
    patterns: [
      /enfoc[aá]\s+(?!archivo\s)(.+)/i,
      /focus\s+(?!archivo\s)(.+)/i,
      /cambi[aá]\s+a\s+(?!archivo\s)(.+)/i,
      /switch\s+to\s+(?!archivo\s)(.+)/i,
    ],
    extractParams: (_text, match) => ({ appName: match[1].trim() }),
  },
  {
    intent: 'minimize_app',
    patterns: [
      /minim[ií]z[aá]\s+(?!archivo\s)(.+)/i,
      /minimize\s+(?!archivo\s)(.+)/i,
    ],
    extractParams: (_text, match) => ({ appName: match[1].trim() }),
  },
  {
    intent: 'close_app',
    patterns: [
      /(?:pod[eé]s|puedes|can you)\s+cerrar?\s+(?:la\s+|el\s+)?(.+?)[\?]?$/i,
      /cerrar?\s+(?:la\s+|el\s+)?(.+?)[\?]?$/i,
      /cerr[aá]\s+(?!archivo\s)(.+)/i,
      /close\s+(?!archivo\s)(.+)/i,
      /mat[aá]\s+(?!archivo\s)(.+)/i,
    ],
    extractParams: (_text, match) => ({ appName: match[1].trim() }),
  },
  {
    intent: 'open_app',
    patterns: [
      /(?:pod[eé]s|puedes|can you)\s+abrir?\s+(?!archivo\s)(.+?)[\?]?$/i,
      /abr[ií]\s+(?!archivo\s)(.+)/i,
      /abre\s+(?!archivo\s)(.+?)[\?]?$/i,
      /open\s+(?!archivo\s)(.+)/i,
      /lanz[aá]\s+(?!archivo\s)(.+)/i,
      /inici[aá]\s+(?!archivo\s)(.+)/i,
      /ejecut[aá]\s+(?!archivo\s)(.+)/i,
    ],
    extractParams: (_text, match) => ({ appName: match[1].trim() }),
  },

  // --- Historial / Ayuda ---
  {
    intent: 'clear_history',
    patterns: [
      /(?:limpi[aá]?|limpiar?|borr[aá]?|borrar?|clear|delete)\s+(?:el\s+)?(?:historial|memoria|chat|conversaci[oó]n)/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'show_history',
    patterns: [
      /historial/i,
      /(?:mis\s+)?[uú]ltimos\s+comandos?/i,
      /command\s+history/i,
    ],
    extractParams: () => ({}),
  },
  {
    intent: 'show_help',
    patterns: [
      /^ayuda$/i,
      /^help$/i,
      /qu[eé]\s+pod[eé]s?\s+hacer/i,
      /qu[eé]\s+comandos?\s+(?:ten[eé]s?|soportás?)/i,
    ],
    extractParams: () => ({}),
  },
];

// ---------------------------------------------------------------------------
// Función principal de parseo
// ---------------------------------------------------------------------------

export function parseCommand(text: string): ParseResult {
  const normalized = text.trim();
  console.log(`[CommandRouter] Parsing: "${normalized}"`);

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const params = rule.extractParams ? rule.extractParams(normalized, match) : {};
        console.log(`[CommandRouter] Matched intent: ${rule.intent}, params:`, params);
        return {
          intent: rule.intent,
          params,
          confidence: 0.9,
          method: 'rules',
        };
      }
    }
  }

  // Fallback: no se reconoció el comando
  console.log(`[CommandRouter] No match found, returning unknown`);
  return {
    intent: 'unknown',
    params: { rawText: text },
    confidence: 0,
    method: 'rules',
  };
}

/**
 * Construye un SkillContext completo a partir del texto del usuario.
 * Este es el punto de entrada principal para el server.
 */
export function buildContext(rawCommand: string, confirmed = false): SkillContext {
  const parsed = parseCommand(rawCommand);
  return {
    rawCommand,
    intent: parsed.intent,
    params: parsed.params,
    confirmed,
  };
}
