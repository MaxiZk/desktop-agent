/**
 * TextEditSkill.ts — Skill para editar archivos de texto con instrucciones en lenguaje natural
 *
 * Soporta operaciones:
 *   - text_append: agregar texto al final
 *   - text_prepend: agregar texto al principio
 *   - text_replace: reemplazar palabra o frase
 *   - text_delete: eliminar línea que contiene una frase
 *   - text_read: leer y devolver contenido
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Skill, SkillResult, SkillContext } from '../Skill.js';

export class TextEditSkill implements Skill {
  readonly name = 'textedit';
  readonly description = 'Edita archivos de texto con instrucciones en lenguaje natural';
  readonly riskLevel = 'low' as const;
  readonly supportedIntents = [
    'text_append',
    'text_prepend',
    'text_replace',
    'text_delete',
    'text_read',
    'txt_edit',
    'word_edit',
  ];

  validate(context: SkillContext): string | null {
    const { intent, params } = context;

    // Todos los intents requieren filePath
    if (!params.filePath || typeof params.filePath !== 'string') {
      return 'Se requiere la ruta del archivo';
    }

    // text_append y text_prepend requieren content
    if ((intent === 'text_append' || intent === 'text_prepend') && !params.content) {
      return 'Se requiere el contenido a agregar';
    }

    // text_replace requiere search y replacement
    if (intent === 'text_replace') {
      if (!params.search || typeof params.search !== 'string') {
        return 'Se requiere el texto a buscar';
      }
      if (!params.replacement || typeof params.replacement !== 'string') {
        return 'Se requiere el texto de reemplazo';
      }
    }

    // text_delete requiere phrase
    if (intent === 'text_delete' && !params.phrase) {
      return 'Se requiere la frase a eliminar';
    }

    return null;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, params } = context;
    const filePath = String(params.filePath);

    try {
      // Resolver ruta absoluta
      const absolutePath = resolve(filePath);

      // Verificar que el archivo existe (excepto para text_append que puede crear)
      if (!existsSync(absolutePath) && intent !== 'text_append') {
        return {
          success: false,
          message: `El archivo no existe: ${filePath}`,
          error: 'File not found',
        };
      }

      switch (intent) {
        case 'text_read':
          return await this.readText(absolutePath, filePath);

        case 'txt_edit': {
          if (!params.filePath) {
            return { success: true, message: '¿Con qué archivo de texto querés trabajar?' };
          }
          
          if (!existsSync(absolutePath)) {
            return { success: false, message: `No encontré: ${absolutePath}` };
          }
          
          const content = await readFile(absolutePath, 'utf-8');
          const lines = content.split('\n').length;
          const words = content.split(/\s+/).filter(Boolean).length;
          
          return {
            success: true,
            message: `Abrí ${filePath}. Tiene ${lines} líneas y ${words} palabras. ¿Qué querés hacer? Puedo agregar texto al final, al principio, reemplazar texto, o eliminar líneas.`,
            data: { filePath: absolutePath, lines, words }
          };
        }

        case 'word_edit': {
          if (!params.filePath) {
            return { success: true, message: '¿Con qué archivo Word querés trabajar?' };
          }
          
          if (!existsSync(absolutePath)) {
            return { success: false, message: `No encontré: ${absolutePath}` };
          }
          
          return {
            success: true,
            message: `Abrí ${filePath}. Para editarlo puedo agregar contenido al final. ¿Qué querés escribir?`,
            data: { filePath: absolutePath }
          };
        }

        case 'text_append':
          return await this.appendText(absolutePath, filePath, String(params.content ?? ''));

        case 'text_prepend':
          return await this.prependText(absolutePath, filePath, String(params.content ?? ''));

        case 'text_replace':
          return await this.replaceText(
            absolutePath,
            filePath,
            String(params.search ?? ''),
            String(params.replacement ?? '')
          );

        case 'text_delete':
          return await this.deleteLine(absolutePath, filePath, String(params.phrase ?? ''));

        default:
          return {
            success: false,
            message: `Intent desconocido: ${intent}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error al procesar el archivo: ${filePath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Operaciones de texto ────────────────────────────────────────────────────

  private async readText(absolutePath: string, displayPath: string): Promise<SkillResult> {
    try {
      const content = await readFile(absolutePath, 'utf-8');
      const lines = content.split('\n').length;
      const chars = content.length;

      return {
        success: true,
        message: `Archivo leído: ${displayPath} (${lines} líneas, ${chars} caracteres)`,
        data: { content, lines, chars, path: displayPath },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al leer el archivo: ${displayPath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async appendText(
    absolutePath: string,
    displayPath: string,
    content: string
  ): Promise<SkillResult> {
    try {
      let existingContent = '';

      // Leer contenido existente si el archivo existe
      if (existsSync(absolutePath)) {
        existingContent = await readFile(absolutePath, 'utf-8');
      }

      // Agregar nueva línea si el archivo no está vacío y no termina con salto de línea
      const needsNewline = existingContent.length > 0 && !existingContent.endsWith('\n');
      const newContent = existingContent + (needsNewline ? '\n' : '') + content + '\n';

      await writeFile(absolutePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Texto agregado al final de ${displayPath}`,
        data: { path: displayPath, addedContent: content },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al agregar texto a ${displayPath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async prependText(
    absolutePath: string,
    displayPath: string,
    content: string
  ): Promise<SkillResult> {
    try {
      const existingContent = await readFile(absolutePath, 'utf-8');
      const newContent = content + '\n' + existingContent;

      await writeFile(absolutePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Texto agregado al principio de ${displayPath}`,
        data: { path: displayPath, addedContent: content },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al agregar texto al principio de ${displayPath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async replaceText(
    absolutePath: string,
    displayPath: string,
    search: string,
    replacement: string
  ): Promise<SkillResult> {
    try {
      const content = await readFile(absolutePath, 'utf-8');

      // Contar ocurrencias antes del reemplazo
      const occurrences = (content.match(new RegExp(this.escapeRegex(search), 'g')) || []).length;

      if (occurrences === 0) {
        return {
          success: false,
          message: `No se encontró "${search}" en ${displayPath}`,
          error: 'Text not found',
        };
      }

      // Reemplazar todas las ocurrencias
      const newContent = content.replace(new RegExp(this.escapeRegex(search), 'g'), replacement);

      await writeFile(absolutePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Reemplazadas ${occurrences} ocurrencia(s) de "${search}" por "${replacement}" en ${displayPath}`,
        data: { path: displayPath, search, replacement, occurrences },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al reemplazar texto en ${displayPath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async deleteLine(
    absolutePath: string,
    displayPath: string,
    phrase: string
  ): Promise<SkillResult> {
    try {
      const content = await readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      // Filtrar líneas que no contienen la frase
      const filteredLines = lines.filter(line => !line.includes(phrase));

      const deletedCount = lines.length - filteredLines.length;

      if (deletedCount === 0) {
        return {
          success: false,
          message: `No se encontró ninguna línea con "${phrase}" en ${displayPath}`,
          error: 'Phrase not found',
        };
      }

      const newContent = filteredLines.join('\n');

      await writeFile(absolutePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Eliminadas ${deletedCount} línea(s) que contenían "${phrase}" de ${displayPath}`,
        data: { path: displayPath, phrase, deletedCount },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al eliminar líneas de ${displayPath}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
