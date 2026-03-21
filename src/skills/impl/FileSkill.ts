/**
 * FileSkill.ts — Skill para operaciones con archivos del sistema
 *
 * Envuelve los módulos existentes:
 *   - search_files.ts       (buscar archivos por nombre)
 *   - read_file_by_path.ts  (leer contenido de un archivo)
 *   - open_file.ts          (abrir con programa predeterminado)
 *   - open_folder.ts        (abrir carpeta contenedora en explorador)
 *   - analyze_csv.ts        (analizar CSV con PapaParse)
 */

import { searchFiles }    from '../search_files.js';
import { readFileByPath } from '../read_file_by_path.js';
import { openFile }       from '../open_file.js';
import { openFolder }     from '../open_folder.js';
import { analyzeCSV }     from '../analyze_csv.js';

import type { Skill, SkillResult, SkillContext } from '../Skill.js';

export class FileSkill implements Skill {
  readonly name = 'file';
  readonly description = 'Busca, lee y abre archivos del sistema de archivos';
  readonly riskLevel = 'low' as const;
  readonly supportedIntents = [
    'search_files',
    'read_file',
    'open_file',
    'open_folder',
    'analyze_csv',
  ];

  validate(_context: SkillContext): string | null {
    // search_files requiere query
    // el resto requiere filePath
    return null; // validación lazy — el módulo subyacente devuelve su propio error
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, params } = context;
    
    switch (intent) {
      case 'search_files': {
        const query     = String(params.query ?? '');
        const directory = params.directory ? String(params.directory) : undefined;

        if (!query) {
          return { success: false, message: 'Se requiere el término de búsqueda' };
        }

        const r = await searchFiles(query, directory);
        return {
          success: r.success,
          message: r.success
            ? `Se encontraron ${r.count} archivo(s) para "${query}"`
            : r.error ?? 'Error en la búsqueda',
          data: { results: r.results, count: r.count, directory: r.directory },
          error: r.error,
        };
      }

      case 'read_file': {
        const filePath = String(params.filePath ?? '');
        if (!filePath) {
          return { success: false, message: 'Se requiere la ruta del archivo' };
        }

        const r = await readFileByPath(filePath);
        return {
          success: r.success,
          message: r.success
            ? `Archivo leído: ${r.path} (${r.size} caracteres)`
            : r.error ?? 'Error al leer',
          data: { content: r.content, path: r.path, size: r.size },
          error: r.error,
        };
      }

      case 'open_file': {
        const filePath = String(params.filePath ?? '');
        if (!filePath) {
          return { success: false, message: 'Se requiere la ruta del archivo' };
        }

        const r = await openFile(filePath);
        return { success: r.success, message: r.message, error: r.error };
      }

      case 'open_folder': {
        const filePath = String(params.filePath ?? '');
        if (!filePath) {
          return { success: false, message: 'Se requiere la ruta del archivo o carpeta' };
        }

        const r = await openFolder(filePath);
        return {
          success: r.success,
          message: r.message,
          data: { folderPath: r.folderPath },
          error: r.error,
        };
      }

      case 'analyze_csv': {
        const filePath = String(params.filePath ?? '');
        if (!filePath) {
          return { success: false, message: 'Se requiere la ruta del archivo CSV' };
        }

        const r = await analyzeCSV(filePath);
        return {
          success: r.success,
          message: r.success
            ? `CSV analizado: ${r.rowCount} filas, columnas: ${r.headers?.join(', ')}`
            : r.error ?? 'Error al analizar CSV',
          data: { rows: r.data, headers: r.headers, rowCount: r.rowCount },
          error: r.error,
        };
      }

      default:
        return { success: false, message: `Intent desconocido: ${intent}` };
    }
  }
}
