/**
 * CommandRouter.test.ts — Tests para el parser de lenguaje natural
 * 
 * Cubre:
 * - Detección de open_app en 8 variantes (español + inglés)
 * - close_app
 * - Los 5 intents de Excel
 * - Intents de sistema
 * - Búsqueda de archivos
 * - Help
 * - Unknown
 * - Validación de estructura ParsedCommand
 * 
 * Nota: Ollama no se llama porque confidenceThreshold = 0.99
 */

import { describe, it, expect } from 'vitest';
import { parseCommand, buildContext } from '../CommandRouter.js';

describe('CommandRouter', () => {
  describe('open_app intent', () => {
    it('should detect "abrí chrome" (español)', () => {
      const result = parseCommand('abrí chrome');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('chrome');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('rules');
    });

    it('should detect "open chrome" (inglés)', () => {
      const result = parseCommand('open chrome');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('chrome');
    });

    it('should detect "lanzá vscode" (español)', () => {
      const result = parseCommand('lanzá vscode');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('vscode');
    });

    it('should detect "iniciá notepad" (español)', () => {
      const result = parseCommand('iniciá notepad');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('notepad');
    });

    it('should detect "ejecutá steam" (español)', () => {
      const result = parseCommand('ejecutá steam');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('steam');
    });

    it('should handle app names with spaces', () => {
      const result = parseCommand('abrí visual studio code');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('visual studio code');
    });

    it('should be case-insensitive', () => {
      const result = parseCommand('ABRÍ CHROME');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('CHROME');
    });

    it('should trim whitespace', () => {
      const result = parseCommand('  abrí   chrome  ');
      expect(result.intent).toBe('open_app');
      expect(result.params.appName).toBe('chrome');
    });
  });

  describe('close_app intent', () => {
    it('should detect "cerrá chrome" (español)', () => {
      const result = parseCommand('cerrá chrome');
      expect(result.intent).toBe('close_app');
      expect(result.params.appName).toBe('chrome');
    });

    it('should detect "close chrome" (inglés)', () => {
      const result = parseCommand('close chrome');
      expect(result.intent).toBe('close_app');
      expect(result.params.appName).toBe('chrome');
    });

    it('should detect "matá notepad" (español coloquial)', () => {
      const result = parseCommand('matá notepad');
      expect(result.intent).toBe('close_app');
      expect(result.params.appName).toBe('notepad');
    });
  });

  describe('list_running_apps intent', () => {
    it('should detect "list running apps" (inglés)', () => {
      const result = parseCommand('list running apps');
      expect(result.intent).toBe('list_running_apps');
      expect(result.params).toEqual({});
    });

    it('should detect "listar apps abiertas" (español)', () => {
      const result = parseCommand('listar apps abiertas');
      expect(result.intent).toBe('list_running_apps');
    });

    it('should detect "qué apps tengo abiertas" (español)', () => {
      const result = parseCommand('qué apps tengo abiertas');
      expect(result.intent).toBe('list_running_apps');
    });
  });

  describe('focus_app intent', () => {
    it('should detect "enfocá vscode" (español)', () => {
      const result = parseCommand('enfocá vscode');
      expect(result.intent).toBe('focus_app');
      expect(result.params.appName).toBe('vscode');
    });

    it('should detect "focus chrome" (inglés)', () => {
      const result = parseCommand('focus chrome');
      expect(result.intent).toBe('focus_app');
      expect(result.params.appName).toBe('chrome');
    });

    it('should detect "cambiá a discord" (español)', () => {
      const result = parseCommand('cambiá a discord');
      expect(result.intent).toBe('focus_app');
      expect(result.params.appName).toBe('discord');
    });
  });

  describe('minimize_app intent', () => {
    it('should detect "minimizá chrome" (español)', () => {
      const result = parseCommand('minimizá chrome');
      expect(result.intent).toBe('minimize_app');
      expect(result.params.appName).toBe('chrome');
    });

    it('should detect "minimize notepad" (inglés)', () => {
      const result = parseCommand('minimize notepad');
      expect(result.intent).toBe('minimize_app');
      expect(result.params.appName).toBe('notepad');
    });
  });

  describe('file intents', () => {
    it('should detect "busca archivo package" (español)', () => {
      const result = parseCommand('busca archivo package');
      expect(result.intent).toBe('search_files');
      expect(result.params.query).toBe('package');
    });

    it('should detect "find file report" (inglés)', () => {
      const result = parseCommand('find file report');
      expect(result.intent).toBe('search_files');
      expect(result.params.query).toBe('report');
    });

    it('should detect "lee package.json" (español)', () => {
      const result = parseCommand('lee package.json');
      expect(result.intent).toBe('read_file');
      expect(result.params.filePath).toBe('package.json');
    });

    it('should detect "read file README.md" (inglés)', () => {
      const result = parseCommand('read file README.md');
      expect(result.intent).toBe('read_file');
      expect(result.params.filePath).toBe('README.md');
    });

    it('should detect "abrí carpeta src" (español)', () => {
      const result = parseCommand('abrí carpeta src');
      expect(result.intent).toBe('open_folder');
      expect(result.params.filePath).toBe('src');
    });

    it('should detect "open folder dist" (inglés)', () => {
      const result = parseCommand('open folder dist');
      expect(result.intent).toBe('open_folder');
      expect(result.params.filePath).toBe('dist');
    });

    it('should detect "analizá csv datos.csv" (español)', () => {
      const result = parseCommand('analizá csv datos.csv');
      expect(result.intent).toBe('analyze_csv');
      expect(result.params.filePath).toBe('datos.csv');
    });
  });

  describe('excel intents', () => {
    it('should detect "lee excel ventas.xlsx" (español)', () => {
      const result = parseCommand('lee excel ventas.xlsx');
      expect(result.intent).toBe('excel_read');
      expect(result.params.filePath).toBe('ventas.xlsx');
    });

    it('should detect "resumen mensual de ventas.xlsx" (español)', () => {
      const result = parseCommand('resumen mensual de ventas.xlsx');
      expect(result.intent).toBe('excel_summary');
      expect(result.params.filePath).toBe('ventas.xlsx');
    });

    it('should detect "summary of sales.xlsx" (inglés)', () => {
      const result = parseCommand('summary of sales.xlsx');
      expect(result.intent).toBe('excel_summary');
      expect(result.params.filePath).toBe('sales.xlsx');
    });

    it('should detect "duplicados por email en clientes.xlsx" (español)', () => {
      const result = parseCommand('duplicados por email en clientes.xlsx');
      expect(result.intent).toBe('excel_duplicates');
      expect(result.params.column).toBe('email');
      expect(result.params.filePath).toBe('clientes.xlsx');
    });

    it('should detect "convertí datos.csv a excel" (español)', () => {
      const result = parseCommand('convertí datos.csv a excel');
      expect(result.intent).toBe('csv_to_excel');
      expect(result.params.filePath).toBe('datos.csv');
    });
  });

  describe('system intents', () => {
    it('should detect "bloqueá pc" (español)', () => {
      const result = parseCommand('bloqueá pc');
      expect(result.intent).toBe('system_lock');
      expect(result.params).toEqual({});
    });

    it('should detect "lock pc" (inglés)', () => {
      const result = parseCommand('lock pc');
      expect(result.intent).toBe('system_lock');
    });

    it('should detect "apagá pc" (español)', () => {
      const result = parseCommand('apagá pc');
      expect(result.intent).toBe('system_shutdown');
      expect(result.params).toEqual({});
    });

    it('should detect "shutdown pc" (inglés)', () => {
      const result = parseCommand('shutdown pc');
      expect(result.intent).toBe('system_shutdown');
    });

    it('should detect "reiniciá pc" (español)', () => {
      const result = parseCommand('reiniciá pc');
      expect(result.intent).toBe('system_restart');
      expect(result.params).toEqual({});
    });

    it('should detect "restart pc" (inglés)', () => {
      const result = parseCommand('restart pc');
      expect(result.intent).toBe('system_restart');
    });

    it('should detect "suspendé pc" (español)', () => {
      const result = parseCommand('suspendé pc');
      expect(result.intent).toBe('system_sleep');
      expect(result.params).toEqual({});
    });

    it('should detect "sleep pc" (inglés)', () => {
      const result = parseCommand('sleep pc');
      expect(result.intent).toBe('system_sleep');
    });
  });

  describe('help and history intents', () => {
    it('should detect "ayuda" (español)', () => {
      const result = parseCommand('ayuda');
      expect(result.intent).toBe('show_help');
      expect(result.params).toEqual({});
    });

    it('should detect "help" (inglés)', () => {
      const result = parseCommand('help');
      expect(result.intent).toBe('show_help');
    });

    it('should detect "historial" (español)', () => {
      const result = parseCommand('historial');
      expect(result.intent).toBe('show_history');
      expect(result.params).toEqual({});
    });

    it('should detect "command history" (inglés)', () => {
      const result = parseCommand('command history');
      expect(result.intent).toBe('show_history');
    });
  });

  describe('unknown intent', () => {
    it('should return unknown for unrecognized command', () => {
      const result = parseCommand('haz algo imposible');
      expect(result.intent).toBe('unknown');
      expect(result.params.rawText).toBe('haz algo imposible');
      expect(result.confidence).toBe(0);
    });

    it('should return unknown for empty command', () => {
      const result = parseCommand('');
      expect(result.intent).toBe('unknown');
    });

    it('should return unknown for gibberish', () => {
      const result = parseCommand('asdfghjkl');
      expect(result.intent).toBe('unknown');
    });
  });

  describe('game intents', () => {
    it('should detect "jugá minecraft" (español)', () => {
      const result = parseCommand('jugá minecraft');
      expect(result.intent).toBe('launch_game');
      expect(result.params.gameName).toBe('minecraft');
    });

    it('should detect "play cs2" (inglés)', () => {
      const result = parseCommand('play cs2');
      expect(result.intent).toBe('launch_game');
      expect(result.params.gameName).toBe('cs2');
    });

    it('should detect "jugá dota2" (español con jugá)', () => {
      const result = parseCommand('jugá dota2');
      expect(result.intent).toBe('launch_game');
      expect(result.params.gameName).toBe('dota2');
    });

    it('should detect "launch el juego minecraft" (inglés explícito)', () => {
      const result = parseCommand('launch el juego minecraft');
      expect(result.intent).toBe('launch_game');
      expect(result.params.gameName).toBe('minecraft');
    });

    it('should detect "lista juegos" (español)', () => {
      const result = parseCommand('lista juegos');
      expect(result.intent).toBe('list_games');
      expect(result.params).toEqual({});
    });

    it('should detect "list games" (inglés)', () => {
      const result = parseCommand('list games');
      expect(result.intent).toBe('list_games');
    });

    it('should detect "abrí steam" (español)', () => {
      const result = parseCommand('abrí steam');
      expect(result.intent).toBe('open_steam');
    });

    it('should detect "open steam" (inglés)', () => {
      const result = parseCommand('open steam');
      expect(result.intent).toBe('open_steam');
    });
  });

  describe('archive intents', () => {
    it('should detect "listá archivo.zip" (español)', () => {
      const result = parseCommand('listá archivo.zip');
      expect(result.intent).toBe('archive_list');
      expect(result.params.archivePath).toBe('archivo.zip');
    });

    it('should detect "list contents of backup.tar.gz" (inglés)', () => {
      const result = parseCommand('list contents of backup.tar.gz');
      expect(result.intent).toBe('archive_list');
      expect(result.params.archivePath).toBe('backup.tar.gz');
    });

    it('should detect "extraé archivo.zip" (español, no dest)', () => {
      const result = parseCommand('extraé archivo.zip');
      expect(result.intent).toBe('archive_extract');
      expect(result.params.archivePath).toBe('archivo.zip');
    });

    it('should detect "extract backup.zip to /tmp/out" (inglés, with dest)', () => {
      const result = parseCommand('extract backup.zip to /tmp/out');
      expect(result.intent).toBe('archive_extract');
      expect(result.params.archivePath).toBe('backup.zip');
      expect(result.params.destPath).toBe('/tmp/out');
    });

    it('should detect "unzip archive.zip" (inglés)', () => {
      const result = parseCommand('unzip archive.zip');
      expect(result.intent).toBe('archive_extract');
      expect(result.params.archivePath).toBe('archive.zip');
    });
  });

  describe('buildContext', () => {
    it('should build complete SkillContext', () => {
      const context = buildContext('abrí chrome', false);
      
      expect(context.rawCommand).toBe('abrí chrome');
      expect(context.intent).toBe('open_app');
      expect(context.params.appName).toBe('chrome');
      expect(context.confirmed).toBe(false);
    });

    it('should handle confirmed flag', () => {
      const context = buildContext('apagá pc', true);
      
      expect(context.rawCommand).toBe('apagá pc');
      expect(context.intent).toBe('system_shutdown');
      expect(context.confirmed).toBe(true);
    });

    it('should default confirmed to false', () => {
      const context = buildContext('lee archivo.txt');
      expect(context.confirmed).toBe(false);
    });
  });
});
