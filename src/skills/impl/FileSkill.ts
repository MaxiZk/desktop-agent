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
import { openFile as osOpenFile } from '../utils/OsAdapter.js';

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
    'file_create',
    'move_file',
    'search_folder',
    'find_and_open',
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

      case 'file_create': {
        const filePath = String(params.filePath ?? '').trim();
        if (!filePath) {
          return { 
            success: false, 
            message: 'Indicame la ruta y nombre del archivo a crear. Ejemplo: ventas.xlsx en /home/maximo/Documents' 
          };
        }
        
        const rawText = String(params.rawText ?? '');
        return this.createFile(filePath, rawText);
      }

      case 'move_file': {
        const source = String(params.source ?? params.filePath ?? '');
        const destination = String(params.destination ?? params.dest ?? '');
        if (!source || !destination) {
          return { 
            success: false, 
            message: 'Necesito la ruta origen y destino. Ejemplo: mové ventas.xlsx a /home/maximo/Documents/backup/' 
          };
        }

        const { resolve, basename, join, dirname } = await import('path');
        const { rename, mkdir, stat } = await import('fs/promises');
        const { existsSync } = await import('fs');

        const absSource = resolve(source);
        let absDest = resolve(destination);

        if (!existsSync(absSource)) {
          return { 
            success: false, 
            message: `No encontré el archivo: ${absSource}` 
          };
        }

        try {
          // If destination is a directory, keep original filename
          const destStat = await stat(absDest).catch(() => null);
          if (destStat && destStat.isDirectory()) {
            absDest = join(absDest, basename(absSource));
          }

          // Create destination directory if needed
          await mkdir(dirname(absDest), { recursive: true });

          // Move the file
          await rename(absSource, absDest);

          return { 
            success: true, 
            message: `Moví ${basename(absSource)} a ${absDest}` 
          };
        } catch (error) {
          return {
            success: false,
            message: `No pude mover el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            error: String(error)
          };
        }
      }

      case 'search_folder': {
        const query = String(params.query ?? params.folderName ?? '');
        const isLinux = process.platform === 'linux';
        const searchPath = String(params.path ?? (isLinux ? '/home' : 'C:\\Users'));

        if (!query) {
          return { 
            success: false, 
            message: 'Indicame qué carpeta buscar' 
          };
        }

        const { execSync } = await import('child_process');
        const isWindows = process.platform === 'win32';

        try {
          const cmd = isWindows
            ? `dir /s /b /ad "${searchPath}\\*${query}*" 2>nul`
            : `find "${searchPath}" -maxdepth 5 -type d -iname "*${query}*" 2>/dev/null | head -10`;

          const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
          const folders = result.split('\n').filter(Boolean).slice(0, 10);

          if (folders.length === 0) {
            return { 
              success: true, 
              message: `No encontré carpetas con el nombre "${query}"` 
            };
          }

          return {
            success: true,
            message: `Encontré ${folders.length} carpeta(s) con "${query}":\n${folders.join('\n')}`,
            data: { folders }
          };
        } catch {
          return { 
            success: false, 
            message: `No pude buscar la carpeta "${query}"` 
          };
        }
      }

      case 'find_and_open': {
        const fileName = String(params.fileName ?? params.query ?? '');
        const searchPath = String(params.path ?? (process.platform === 'win32' ? 'C:\\Users' : '/home/' + (process.env.USER || 'user')));

        if (!fileName) {
          return { success: false, message: 'Indicame el nombre del archivo a buscar' };
        }

        const { execSync } = await import('child_process');
        const isWin = process.platform === 'win32';

        try {
          const cmd = isWin
            ? `dir /s /b "${searchPath}\\*${fileName}*" 2>nul`
            : `find "${searchPath}" -maxdepth 6 -iname "*${fileName}*" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -5`;

          const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
          const files = result.split('\n').filter(Boolean).slice(0, 5);

          if (files.length === 0) {
            return { success: false, message: `No encontré ningún archivo con el nombre "${fileName}"` };
          }

          if (files.length === 1) {
            // Open directly
            await osOpenFile(files[0]);
            return { success: true, message: `Encontré y abrí: ${files[0]}` };
          }

          // Multiple results — open the first and list others
          await osOpenFile(files[0]);
          return {
            success: true,
            message: `Encontré ${files.length} archivos. Abrí el primero: ${files[0]}\nOtros encontrados:\n${files.slice(1).join('\n')}`,
            data: { files }
          };
        } catch {
          return { success: false, message: `Error buscando "${fileName}"` };
        }
      }

      default:
        return { success: false, message: `Intent desconocido: ${intent}` };
    }
  }

  private async createFile(filePath: string, originalText?: string): Promise<SkillResult> {
    const { resolve, dirname, extname } = await import('path');
    const { mkdir, writeFile } = await import('fs/promises');
    
    // Determine extension from path or from original text
    let absPath = resolve(filePath);
    const ext = extname(absPath).toLowerCase();
    
    // If no extension, guess from original text
    if (!ext) {
      const text = (originalText ?? '').toLowerCase();
      if (text.includes('word') || text.includes('docx')) {
        absPath += '.docx';
      } else if (text.includes('txt') || text.includes('texto')) {
        absPath += '.txt';
      } else {
        absPath += '.xlsx'; // default to excel
      }
    }
    
    const finalExt = extname(absPath).toLowerCase();
    await mkdir(dirname(absPath), { recursive: true });
    
    try {
      if (finalExt === '.xlsx' || finalExt === '.xls') {
        // Create Excel file
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Hoja1');
        ws.addRow(['Columna A', 'Columna B', 'Columna C']);
        ws.getRow(1).font = { bold: true };
        ws.columns.forEach(col => { col.width = 18; });
        await wb.xlsx.writeFile(absPath);
        
        // After successful file creation, open it
        try {
          await osOpenFile(absPath);
        } catch {
          // Don't fail if opening fails
        }
      } else if (finalExt === '.docx') {
        // Create Word file
        const { Document, Packer, Paragraph } = await import('docx');
        const doc = new Document({
          sections: [{ children: [new Paragraph('')] }]
        });
        const buffer = await Packer.toBuffer(doc);
        await writeFile(absPath, buffer);
        
        // After successful file creation, open it
        try {
          await osOpenFile(absPath);
        } catch {
          // Don't fail if opening fails
        }
      } else if (finalExt === '.txt' || finalExt === '.csv') {
        // Create empty text/csv file
        await writeFile(absPath, '', 'utf-8');
        
        // After successful file creation, open it
        try {
          await osOpenFile(absPath);
        } catch {
          // Don't fail if opening fails
        }
      }
      
      return {
        success: true,
        message: `Archivo creado y abierto: ${absPath}`,
        data: { path: absPath }
      };
    } catch (error) {
      return {
        success: false,
        message: `No pude crear el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        error: String(error)
      };
    }
  }
}
