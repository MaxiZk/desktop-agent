/**
 * ExcelSkill.test.ts — Tests para la skill de Excel/CSV
 * 
 * Cubre:
 * - Leer CSV y XLSX
 * - CSV → XLSX verificando que el archivo existe
 * - Resumen por mes con totales/promedios
 * - Detección de duplicados con y sin columna
 * - Hoja Resumen generada en el XLSX
 * - Intents inválidos
 * 
 * Todo en test-temp/excel-skill/ que se limpia al final
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ExcelSkill } from '../impl/ExcelSkill.js';
import type { SkillContext } from '../Skill.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import ExcelJS from 'exceljs';

const TEST_DIR = 'test-temp/excel-skill';

describe('ExcelSkill', () => {
  let skill: ExcelSkill;

  beforeAll(async () => {
    // Crear directorio de tests
    mkdirSync(TEST_DIR, { recursive: true });

    // Crear archivo CSV de prueba
    const csvContent = `Fecha,Producto,Cantidad,Precio
2024-01-15,Laptop,2,1200
2024-01-20,Mouse,5,25
2024-02-10,Teclado,3,75
2024-02-15,Monitor,1,300
2024-03-05,Laptop,1,1200
2024-03-10,Mouse,10,25`;
    writeFileSync(join(TEST_DIR, 'ventas.csv'), csvContent, 'utf-8');

    // Crear archivo CSV con duplicados
    const csvDuplicates = `Email,Nombre,Edad
juan@test.com,Juan,25
maria@test.com,Maria,30
juan@test.com,Juan Perez,25
pedro@test.com,Pedro,35
maria@test.com,Maria Garcia,31`;
    writeFileSync(join(TEST_DIR, 'clientes.csv'), csvDuplicates, 'utf-8');

    // Crear archivo XLSX de prueba
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos');
    worksheet.addRow(['Mes', 'Ventas', 'Gastos']);
    worksheet.addRow(['Enero', 5000, 3000]);
    worksheet.addRow(['Febrero', 6000, 3500]);
    worksheet.addRow(['Marzo', 5500, 3200]);
    await workbook.xlsx.writeFile(join(TEST_DIR, 'finanzas.xlsx'));

    skill = new ExcelSkill();
  });

  afterAll(() => {
    // Limpiar directorio de tests
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('validation', () => {
    it('should require filePath parameter', () => {
      const context: SkillContext = {
        rawCommand: 'lee excel',
        intent: 'excel_read',
        params: {},
      };

      const error = skill.validate(context);
      expect(error).toBe('¿Con qué archivo Excel querés que trabaje? Decime la ruta o el nombre del archivo.');
    });

    it('should accept valid filePath', () => {
      const context: SkillContext = {
        rawCommand: 'lee excel ventas.xlsx',
        intent: 'excel_read',
        params: { filePath: 'ventas.xlsx' },
      };

      const error = skill.validate(context);
      expect(error).toBeNull();
    });
  });

  describe('excel_read - CSV', () => {
    it('should read CSV file', async () => {
      const context: SkillContext = {
        rawCommand: 'lee ventas.csv',
        intent: 'excel_read',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('CSV leído');
      expect(result.message).toContain('6 filas');
      expect(result.data).toBeDefined();
      
      const data = result.data as any;
      expect(data.rows).toHaveLength(6);
      expect(data.headers).toEqual(['Fecha', 'Producto', 'Cantidad', 'Precio']);
      expect(data.rowCount).toBe(6);
    });

    it('should parse CSV with correct data types', async () => {
      const context: SkillContext = {
        rawCommand: 'lee ventas.csv',
        intent: 'excel_read',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);
      const data = result.data as any;
      const firstRow = data.rows[0];

      expect(firstRow.Producto).toBe('Laptop');
      expect(firstRow.Cantidad).toBe(2);
      expect(firstRow.Precio).toBe(1200);
    });
  });

  describe('excel_read - XLSX', () => {
    it('should read XLSX file', async () => {
      const context: SkillContext = {
        rawCommand: 'lee finanzas.xlsx',
        intent: 'excel_read',
        params: { filePath: join(TEST_DIR, 'finanzas.xlsx') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Excel leído');
      expect(result.message).toContain('3 filas');
      
      const data = result.data as any;
      expect(data.rows).toHaveLength(3);
      expect(data.headers).toEqual(['Mes', 'Ventas', 'Gastos']);
    });

    it('should handle non-existent file', async () => {
      const context: SkillContext = {
        rawCommand: 'lee noexiste.xlsx',
        intent: 'excel_read',
        params: { filePath: join(TEST_DIR, 'noexiste.xlsx') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Archivo no encontrado');
    });

    it('should reject unsupported format', async () => {
      // Crear archivo .txt
      writeFileSync(join(TEST_DIR, 'test.txt'), 'test content', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'lee test.txt',
        intent: 'excel_read',
        params: { filePath: join(TEST_DIR, 'test.txt') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Formato no soportado');
    });
  });

  describe('excel_csv_to_xlsx', () => {
    it('should convert CSV to XLSX', async () => {
      const context: SkillContext = {
        rawCommand: 'convertí ventas.csv a excel',
        intent: 'excel_csv_to_xlsx',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('CSV convertido a Excel');
      expect(result.message).toContain('6 filas');
      
      const data = result.data as any;
      expect(data.outputPath).toContain('.xlsx');
      expect(data.rowCount).toBe(6);
      expect(data.headers).toEqual(['Fecha', 'Producto', 'Cantidad', 'Precio']);

      // Verificar que el archivo XLSX existe
      expect(existsSync(data.outputPath)).toBe(true);
    });

    it('should create XLSX with formatted headers', async () => {
      const context: SkillContext = {
        rawCommand: 'convertí ventas.csv a excel',
        intent: 'excel_csv_to_xlsx',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);
      const data = result.data as any;

      // Leer el archivo XLSX generado
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(data.outputPath);
      const worksheet = workbook.worksheets[0];

      // Verificar que la primera fila tiene formato
      const headerRow = worksheet.getRow(1);
      expect(headerRow.font?.bold).toBe(true);
    });
  });

  describe('excel_summary_by_month', () => {
    it('should generate monthly summary', async () => {
      const context: SkillContext = {
        rawCommand: 'resumen mensual de ventas.csv',
        intent: 'excel_summary_by_month',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Resumen generado');
      expect(result.message).toContain('3 meses');
      
      const data = result.data as any;
      expect(data.summary).toHaveLength(3);
      expect(data.dateColumn).toBe('Fecha');
      expect(data.valueColumn).toBe('Precio');

      // Verificar estructura del resumen
      const enero = data.summary.find((s: any) => s.mes === '2024-01');
      expect(enero).toBeDefined();
      expect(enero.cantidad).toBe(2);
      expect(enero.total).toBeGreaterThan(0);
      expect(enero.promedio).toBeGreaterThan(0);
    });

    it('should calculate correct totals and averages', async () => {
      const context: SkillContext = {
        rawCommand: 'resumen mensual de ventas.csv',
        intent: 'excel_summary_by_month',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);
      const data = result.data as any;

      // Enero: 2 filas, suma de Precio = 1200 + 25 = 1225
      const enero = data.summary.find((s: any) => s.mes === '2024-01');
      expect(enero.total).toBe(1225);
      expect(enero.promedio).toBe(612.5);
    });

    it('should create summary sheet in XLSX', async () => {
      const xlsxPath = join(TEST_DIR, 'ventas.xlsx');
      
      // Primero convertir CSV a XLSX
      const convertContext: SkillContext = {
        rawCommand: 'convertí ventas.csv a excel',
        intent: 'excel_csv_to_xlsx',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };
      await skill.execute(convertContext);

      // Luego generar resumen
      const summaryContext: SkillContext = {
        rawCommand: 'resumen mensual de ventas.xlsx',
        intent: 'excel_summary_by_month',
        params: { filePath: xlsxPath },
      };
      const result = await skill.execute(summaryContext);

      expect(result.success).toBe(true);

      // Verificar que la hoja "Resumen por Mes" existe
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(xlsxPath);
      const summarySheet = workbook.getWorksheet('Resumen por Mes');
      
      expect(summarySheet).toBeDefined();
      expect(summarySheet?.rowCount).toBeGreaterThan(1);
    });
  });

  describe('excel_find_duplicates', () => {
    it('should find duplicates by column', async () => {
      const context: SkillContext = {
        rawCommand: 'duplicados por Email en clientes.csv',
        intent: 'excel_find_duplicates',
        params: { 
          filePath: join(TEST_DIR, 'clientes.csv'),
          column: 'Email'
        },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Se encontraron');
      expect(result.message).toContain('duplicado');
      
      const data = result.data as any;
      expect(data.duplicates).toHaveLength(2);
      expect(data.columnsChecked).toEqual(['Email']);

      // Verificar duplicados encontrados
      const juanDup = data.duplicates.find((d: any) => d.value === 'juan@test.com');
      expect(juanDup).toBeDefined();
      expect(juanDup.count).toBe(2);
      expect(juanDup.rows).toHaveLength(2);

      const mariaDup = data.duplicates.find((d: any) => d.value === 'maria@test.com');
      expect(mariaDup).toBeDefined();
      expect(mariaDup.count).toBe(2);
    });

    it('should find duplicates in all columns when no column specified', async () => {
      const context: SkillContext = {
        rawCommand: 'duplicados en clientes.csv',
        intent: 'excel_find_duplicates',
        params: { 
          filePath: join(TEST_DIR, 'clientes.csv')
        },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.columnsChecked).toEqual(['Email', 'Nombre', 'Edad']);
      expect(data.duplicates.length).toBeGreaterThan(0);
    });

    it('should report no duplicates when none exist', async () => {
      // Crear CSV sin duplicados
      const csvNoDup = `ID,Nombre
1,Juan
2,Maria
3,Pedro`;
      writeFileSync(join(TEST_DIR, 'sin-duplicados.csv'), csvNoDup, 'utf-8');

      const context: SkillContext = {
        rawCommand: 'duplicados en sin-duplicados.csv',
        intent: 'excel_find_duplicates',
        params: { 
          filePath: join(TEST_DIR, 'sin-duplicados.csv')
        },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No se encontraron duplicados');
      
      const data = result.data as any;
      expect(data.duplicates).toHaveLength(0);
    });
  });

  describe('excel_create_summary_sheet', () => {
    it('should create summary sheet with statistics', async () => {
      const context: SkillContext = {
        rawCommand: 'crear hoja resumen en finanzas.xlsx',
        intent: 'excel_create_summary_sheet',
        params: { filePath: join(TEST_DIR, 'finanzas.xlsx') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Hoja "Resumen" creada');
      
      const data = result.data as any;
      expect(data.stats).toHaveLength(2); // Ventas y Gastos
      expect(data.filePath).toContain('finanzas.xlsx');

      // Verificar estadísticas
      const ventasStats = data.stats.find((s: any) => s.columna === 'Ventas');
      expect(ventasStats).toBeDefined();
      expect(ventasStats.total).toBe(16500); // 5000 + 6000 + 5500
      expect(ventasStats.promedio).toBe(5500);
      expect(ventasStats.filas).toBe(3);
    });

    it('should replace existing summary sheet', async () => {
      const xlsxPath = join(TEST_DIR, 'finanzas.xlsx');

      // Crear resumen primera vez
      const context1: SkillContext = {
        rawCommand: 'crear hoja resumen',
        intent: 'excel_create_summary_sheet',
        params: { filePath: xlsxPath },
      };
      await skill.execute(context1);

      // Crear resumen segunda vez (debe reemplazar)
      const context2: SkillContext = {
        rawCommand: 'crear hoja resumen',
        intent: 'excel_create_summary_sheet',
        params: { filePath: xlsxPath },
      };
      const result2 = await skill.execute(context2);

      expect(result2.success).toBe(true);

      // Verificar que solo hay una hoja "Resumen"
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(xlsxPath);
      const summarySheets = workbook.worksheets.filter(ws => ws.name === 'Resumen');
      expect(summarySheets).toHaveLength(1);
    });
  });

  describe('invalid intents', () => {
    it('should reject unknown intent', async () => {
      const context: SkillContext = {
        rawCommand: 'hacer algo raro',
        intent: 'excel_unknown',
        params: { filePath: join(TEST_DIR, 'ventas.csv') },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Intent desconocido');
    });
  });

  describe('skill metadata', () => {
    it('should have correct metadata', () => {
      expect(skill.name).toBe('excel');
      expect(skill.description).toContain('Excel');
      expect(skill.riskLevel).toBe('low');
      expect(skill.supportedIntents).toContain('excel_read');
      expect(skill.supportedIntents).toContain('excel_csv_to_xlsx');
      expect(skill.supportedIntents).toContain('excel_summary_by_month');
      expect(skill.supportedIntents).toContain('excel_find_duplicates');
      expect(skill.supportedIntents).toContain('excel_create_summary_sheet');
    });
  });
});
