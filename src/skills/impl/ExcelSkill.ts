/**
 * ExcelSkill.ts — Skill estrella del agente
 *
 * Cubre todas las operaciones Excel/CSV del proyecto de tesis:
 *   - Leer archivos .xlsx y .csv
 *   - Detectar duplicados por columna
 *   - Agrupar y resumir por mes o categoría
 *   - Calcular totales y promedios
 *   - Crear hoja "Resumen" en el archivo
 *   - Exportar resultado a nuevo archivo
 *   - Convertir CSV → XLSX
 *
 * Usa ExcelJS (ya instalado) y PapaParse (ya instalado).
 */

import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, extname, dirname } from 'path';

import type { Skill, SkillResult, SkillContext } from '../Skill.js';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DataRow {
  [key: string]: string | number | Date | null;
}

// ─── ExcelSkill ───────────────────────────────────────────────────────────────

export class ExcelSkill implements Skill {
  readonly name = 'excel';
  readonly description = 'Procesa archivos Excel y CSV: resúmenes, duplicados, conversiones';
  readonly riskLevel = 'low' as const;
  readonly supportedIntents = [
    'excel_read',
    'excel_create',
    'excel_edit',
    'excel_append_row',
    'excel_csv_to_xlsx',
    'excel_summary_by_month',
    'excel_find_duplicates',
    'excel_create_summary_sheet',
  ];

  validate(context: SkillContext): string | null {
    if (!context.params.filePath || typeof context.params.filePath !== 'string') {
      return '¿Con qué archivo Excel querés que trabaje? Decime la ruta o el nombre del archivo.';
    }
    return null;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, params } = context;
    
    switch (intent) {
      case 'excel_read':
        return this.readFile(params.filePath as string);

      case 'excel_create':
        return this.createFile(params.filePath as string);

      case 'excel_edit': {
        const filePath = String(params.filePath ?? '');
        if (!filePath) {
          return { success: true, message: '¿Con qué archivo Excel querés trabajar?' };
        }
        
        const absPath = resolve(filePath);
        if (!existsSync(absPath)) {
          return { success: false, message: `No encontré: ${absPath}` };
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(absPath);
        const ws = workbook.worksheets[0];
        
        const headers: string[] = [];
        ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? '')));
        
        return {
          success: true,
          message: `Abrí ${filePath}. Tiene ${ws.rowCount - 1} filas y columnas: ${headers.join(', ')}. ¿Qué querés hacer? Puedo agregar filas, buscar duplicados, hacer resumen por mes, o crear hoja resumen.`,
          data: { filePath: absPath, headers, rowCount: ws.rowCount - 1 }
        };
      }

      case 'excel_append_row': {
        const filePath = String(params.filePath ?? '');
        const content = String(params.content ?? '');
        const values = content.split(',').map((s: string) => s.trim());
        
        if (!filePath) {
          return { success: false, message: 'Indicame el archivo Excel' };
        }
        
        const absPath = resolve(filePath);
        if (!existsSync(absPath)) {
          return { success: false, message: `No encontré: ${absPath}` };
        }
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(absPath);
        const ws = workbook.worksheets[0];
        ws.addRow(values);
        await workbook.xlsx.writeFile(absPath);
        
        return { success: true, message: `Fila agregada: ${values.join(', ')}` };
      }

      case 'excel_csv_to_xlsx':
        return this.csvToXlsx(params.filePath as string);

      case 'excel_summary_by_month':
        return this.summaryByMonth(
          params.filePath as string,
          params.dateColumn as string | undefined,
          params.valueColumn as string | undefined
        );

      case 'excel_find_duplicates':
        return this.findDuplicates(
          params.filePath as string,
          params.column as string | undefined
        );

      case 'excel_create_summary_sheet':
        return this.createSummarySheet(params.filePath as string);

      default:
        return { success: false, message: `Intent desconocido: ${intent}` };
    }
  }

  // ── Leer archivo (xlsx o csv) ───────────────────────────────────────────────

  private async createFile(filePath: string): Promise<SkillResult> {
    const absPath = resolve(filePath.endsWith('.xlsx') ? filePath : filePath + '.xlsx');
    
    try {
      await mkdir(dirname(absPath), { recursive: true });
      
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Hoja1');
      
      // Add header row
      ws.addRow(['Columna A', 'Columna B', 'Columna C']);
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' },
      };
      
      // Set column widths
      ws.columns.forEach(col => { col.width = 18; });
      
      await workbook.xlsx.writeFile(absPath);
      
      return {
        success: true,
        message: `Archivo Excel creado: ${absPath}`,
        data: { path: absPath }
      };
    } catch (error) {
      return {
        success: false,
        message: `No pude crear el archivo Excel`,
        error: error instanceof Error ? error.message : 'unknown'
      };
    }
  }

  private async readFile(filePath: string): Promise<SkillResult> {
    const absPath = resolve(filePath);

    if (!existsSync(absPath)) {
      return { success: false, message: `Archivo no encontrado: ${absPath}` };
    }

    const ext = extname(absPath).toLowerCase();

    if (ext === '.csv') {
      return this.readCSV(absPath);
    }
    if (ext === '.xlsx' || ext === '.xls') {
      return this.readXLSX(absPath);
    }

    return { success: false, message: `Formato no soportado: ${ext}` };
  }

  private async readCSV(absPath: string): Promise<SkillResult> {
    const content = await readFile(absPath, 'utf-8');
    const result = Papa.parse<DataRow>(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    return {
      success: true,
      message: `CSV leído: ${result.data.length} filas, columnas: ${result.meta.fields?.join(', ')}`,
      data: {
        rows: result.data,
        headers: result.meta.fields ?? [],
        rowCount: result.data.length,
      },
    };
  }

  private async readXLSX(absPath: string): Promise<SkillResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(absPath);

    const ws = workbook.worksheets[0];
    if (!ws) {
      return { success: false, message: 'El archivo no tiene hojas' };
    }

    const rows: DataRow[] = [];
    const headers: string[] = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) {
        row.eachCell(cell => headers.push(String(cell.value ?? '')));
      } else {
        const obj: DataRow = {};
        row.eachCell((cell, colNum) => {
          obj[headers[colNum - 1] ?? colNum] = cell.value as string | number | null;
        });
        rows.push(obj);
      }
    });

    return {
      success: true,
      message: `Excel leído: ${rows.length} filas, columnas: ${headers.join(', ')}`,
      data: { rows, headers, rowCount: rows.length },
    };
  }

  // ── CSV → XLSX ──────────────────────────────────────────────────────────────

  private async csvToXlsx(csvPath: string): Promise<SkillResult> {
    const absPath = resolve(csvPath);

    if (!existsSync(absPath)) {
      return { success: false, message: `Archivo no encontrado: ${absPath}` };
    }

    const content = await readFile(absPath, 'utf-8');
    const parsed = Papa.parse<DataRow>(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    const headers = parsed.meta.fields ?? [];
    const rows = parsed.data;

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Datos');

    // Encabezados en negrita
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Datos
    rows.forEach(row => {
      ws.addRow(headers.map(h => row[h] ?? ''));
    });

    // Auto-ancho de columnas
    ws.columns.forEach(col => {
      col.width = 16;
    });

    // Guardar como .xlsx en la misma carpeta
    const outputPath = absPath.replace(/\.csv$/i, '.xlsx');
    await workbook.xlsx.writeFile(outputPath);

    return {
      success: true,
      message: `CSV convertido a Excel: ${outputPath} (${rows.length} filas)`,
      data: { outputPath, rowCount: rows.length, headers },
    };
  }

  // ── Resumen por mes ─────────────────────────────────────────────────────────

  private async summaryByMonth(
    filePath: string,
    dateColumnHint?: string,
    valueColumnHint?: string
  ): Promise<SkillResult> {
    const readResult = await this.readFile(filePath);
    if (!readResult.success) return readResult;

    const { rows, headers } = readResult.data as { rows: DataRow[]; headers: string[] };

    // Auto-detectar columna de fecha
    const dateCol =
      dateColumnHint ??
      headers.find(h =>
        /fecha|date|mes|month|periodo|period/i.test(h)
      );

    if (!dateCol) {
      return {
        success: false,
        message: `No se encontró columna de fecha. Columnas disponibles: ${headers.join(', ')}`,
      };
    }

    // Auto-detectar columna de valor numérico
    const valueCol =
      valueColumnHint ??
      headers.find(h =>
        /total|monto|importe|amount|valor|value|ventas|sales|precio|price/i.test(h)
      ) ??
      headers.find(h => h !== dateCol && typeof rows[0]?.[h] === 'number');

    // Agrupar por mes
    const monthMap = new Map<string, { count: number; total: number; values: number[] }>();

    for (const row of rows) {
      const rawDate = row[dateCol];
      if (!rawDate) continue;

      const date = new Date(String(rawDate));
      if (isNaN(date.getTime())) continue;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthMap.get(monthKey) ?? { count: 0, total: 0, values: [] };

      current.count++;
      if (valueCol) {
        const val = Number(row[valueCol] ?? 0);
        if (!isNaN(val)) {
          current.total += val;
          current.values.push(val);
        }
      }

      monthMap.set(monthKey, current);
    }

    // Armar resumen
    const summary = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        mes: month,
        cantidad: data.count,
        total: valueCol ? Number(data.total.toFixed(2)) : null,
        promedio: valueCol && data.values.length > 0
          ? Number((data.total / data.values.length).toFixed(2))
          : null,
      }));

    // Escribir hoja "Resumen por Mes" en el archivo
    await this.appendSummarySheet(filePath, 'Resumen por Mes', summary);

    return {
      success: true,
      message: `Resumen generado: ${summary.length} meses. Hoja "Resumen por Mes" agregada al archivo.`,
      data: { summary, dateColumn: dateCol, valueColumn: valueCol ?? null },
    };
  }

  // ── Detectar duplicados ─────────────────────────────────────────────────────

  private async findDuplicates(
    filePath: string,
    columnHint?: string
  ): Promise<SkillResult> {
    const readResult = await this.readFile(filePath);
    if (!readResult.success) return readResult;

    const { rows, headers } = readResult.data as { rows: DataRow[]; headers: string[] };

    // Si no se especificó columna, buscar por todas
    const columnsToCheck = columnHint
      ? [columnHint]
      : headers;

    const duplicates: Array<{
      column: string;
      value: string | number;
      rows: number[];
      count: number;
    }> = [];

    for (const col of columnsToCheck) {
      const seen = new Map<string, number[]>();

      rows.forEach((row, idx) => {
        const val = String(row[col] ?? '').trim();
        if (!val) return;

        const existing = seen.get(val) ?? [];
        existing.push(idx + 2); // +2 porque fila 1 = encabezado
        seen.set(val, existing);
      });

      for (const [value, rowNums] of seen.entries()) {
        if (rowNums.length > 1) {
          duplicates.push({
            column: col,
            value,
            rows: rowNums,
            count: rowNums.length,
          });
        }
      }
    }

    const message = duplicates.length === 0
      ? `No se encontraron duplicados en: ${columnsToCheck.join(', ')}`
      : `Se encontraron ${duplicates.length} valor(es) duplicado(s)`;

    return {
      success: true,
      message,
      data: { duplicates, columnsChecked: columnsToCheck },
    };
  }

  // ── Crear hoja Resumen ──────────────────────────────────────────────────────

  private async createSummarySheet(filePath: string): Promise<SkillResult> {
    const absPath = resolve(filePath);

    if (!existsSync(absPath)) {
      return { success: false, message: `Archivo no encontrado: ${absPath}` };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(absPath);

    const ws = workbook.worksheets[0];
    if (!ws) {
      return { success: false, message: 'El archivo no tiene hojas de datos' };
    }

    // Detectar columnas numéricas
    const headers: string[] = [];
    ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? '')));

    const numericCols: number[] = [];
    ws.getRow(2).eachCell((cell, colNum) => {
      if (typeof cell.value === 'number') numericCols.push(colNum);
    });

    // Calcular totales y promedios por columna numérica
    const stats: Array<{ columna: string; total: number; promedio: number; filas: number }> = [];

    for (const colNum of numericCols) {
      let total = 0;
      let count = 0;

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const val = Number(row.getCell(colNum).value ?? 0);
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      });

      stats.push({
        columna: headers[colNum - 1] ?? `Col ${colNum}`,
        total: Number(total.toFixed(2)),
        promedio: count > 0 ? Number((total / count).toFixed(2)) : 0,
        filas: count,
      });
    }

    // Crear / reemplazar hoja "Resumen"
    const existing = workbook.getWorksheet('Resumen');
    if (existing) workbook.removeWorksheet(existing.id);

    const summaryWs = workbook.addWorksheet('Resumen');
    summaryWs.addRow(['Columna', 'Total', 'Promedio', 'Filas con datos']);
    summaryWs.getRow(1).font = { bold: true };

    stats.forEach(s => {
      summaryWs.addRow([s.columna, s.total, s.promedio, s.filas]);
    });

    summaryWs.columns.forEach(col => { col.width = 20; });

    await workbook.xlsx.writeFile(absPath);

    return {
      success: true,
      message: `Hoja "Resumen" creada con ${stats.length} columnas analizadas.`,
      data: { stats, filePath: absPath },
    };
  }

  // ── Helper: agregar hoja de resumen genérica ────────────────────────────────

  private async appendSummarySheet(
    filePath: string,
    sheetName: string,
    data: Record<string, unknown>[]
  ): Promise<void> {
    const absPath = resolve(filePath);
    const ext = extname(absPath).toLowerCase();

    // Para CSV, crear un xlsx nuevo al lado
    const targetPath = ext === '.csv' ? absPath.replace(/\.csv$/i, '.xlsx') : absPath;

    const workbook = new ExcelJS.Workbook();

    if (existsSync(targetPath)) {
      await workbook.xlsx.readFile(targetPath);
    }

    const existing = workbook.getWorksheet(sheetName);
    if (existing) workbook.removeWorksheet(existing.id);

    const ws = workbook.addWorksheet(sheetName);

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };
      data.forEach(row => ws.addRow(headers.map(h => row[h])));
      ws.columns.forEach(col => { col.width = 18; });
    }

    await workbook.xlsx.writeFile(targetPath);
  }
}
