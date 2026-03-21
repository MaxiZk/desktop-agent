/**
 * TextEditSkill.test.ts — Tests for text file editing skill
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextEditSkill } from '../TextEditSkill.js';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { SkillContext } from '../../Skill.js';

describe('TextEditSkill', () => {
  const skill = new TextEditSkill();
  const testDir = resolve(process.cwd(), 'test-temp');
  const testFile = resolve(testDir, 'test-edit.txt');

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  describe('metadata', () => {
    it('should have correct skill metadata', () => {
      expect(skill.name).toBe('textedit');
      expect(skill.description).toContain('texto');
      expect(skill.riskLevel).toBe('medium');
      expect(skill.supportedIntents).toContain('text_append');
      expect(skill.supportedIntents).toContain('text_prepend');
      expect(skill.supportedIntents).toContain('text_replace');
      expect(skill.supportedIntents).toContain('text_delete');
      expect(skill.supportedIntents).toContain('text_read');
    });
  });

  describe('validate', () => {
    it('should require filePath for all intents', () => {
      const context: SkillContext = {
        rawCommand: 'test',
        intent: 'text_append',
        params: {},
      };

      const error = skill.validate(context);
      expect(error).toContain('ruta del archivo');
    });

    it('should require content for text_append', () => {
      const context: SkillContext = {
        rawCommand: 'test',
        intent: 'text_append',
        params: { filePath: 'test.txt' },
      };

      const error = skill.validate(context);
      expect(error).toContain('contenido');
    });

    it('should require search and replacement for text_replace', () => {
      const context: SkillContext = {
        rawCommand: 'test',
        intent: 'text_replace',
        params: { filePath: 'test.txt' },
      };

      const error = skill.validate(context);
      expect(error).toContain('buscar');
    });

    it('should require phrase for text_delete', () => {
      const context: SkillContext = {
        rawCommand: 'test',
        intent: 'text_delete',
        params: { filePath: 'test.txt' },
      };

      const error = skill.validate(context);
      expect(error).toContain('frase');
    });

    it('should pass validation with correct params', () => {
      const context: SkillContext = {
        rawCommand: 'test',
        intent: 'text_append',
        params: { filePath: 'test.txt', content: 'hello' },
      };

      const error = skill.validate(context);
      expect(error).toBeNull();
    });
  });

  describe('text_read', () => {
    it('should read file content', async () => {
      // Create test file
      writeFileSync(testFile, 'Line 1\nLine 2\nLine 3', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'leé test-edit.txt',
        intent: 'text_read',
        params: { filePath: testFile },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('leído');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('lines');
      expect(result.data).toHaveProperty('chars');
    });

    it('should fail if file does not exist', async () => {
      const context: SkillContext = {
        rawCommand: 'leé nonexistent.txt',
        intent: 'text_read',
        params: { filePath: 'nonexistent.txt' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no existe');
    });
  });

  describe('text_append', () => {
    it('should append text to existing file', async () => {
      // Create test file
      writeFileSync(testFile, 'Line 1\nLine 2', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'agregá al final de test-edit.txt: Line 3',
        intent: 'text_append',
        params: { filePath: testFile, content: 'Line 3' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('agregado al final');

      // Verify file content
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('Line 1');
      expect(content).toContain('Line 2');
      expect(content).toContain('Line 3');
    });

    it('should create file if it does not exist', async () => {
      const context: SkillContext = {
        rawCommand: 'agregá al final de test-edit.txt: First line',
        intent: 'text_append',
        params: { filePath: testFile, content: 'First line' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(existsSync(testFile)).toBe(true);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('First line');
    });
  });

  describe('text_prepend', () => {
    it('should prepend text to file', async () => {
      // Create test file
      writeFileSync(testFile, 'Line 2\nLine 3', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'agregá al principio de test-edit.txt: Line 1',
        intent: 'text_prepend',
        params: { filePath: testFile, content: 'Line 1' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('agregado al principio');

      // Verify file content
      const content = readFileSync(testFile, 'utf-8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('Line 1');
    });

    it('should fail if file does not exist', async () => {
      const context: SkillContext = {
        rawCommand: 'agregá al principio de nonexistent.txt: text',
        intent: 'text_prepend',
        params: { filePath: 'nonexistent.txt', content: 'text' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no existe');
    });
  });

  describe('text_replace', () => {
    it('should replace text in file', async () => {
      // Create test file
      writeFileSync(testFile, 'Hello world\nHello universe', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'reemplazá "Hello" por "Hi" en test-edit.txt',
        intent: 'text_replace',
        params: { filePath: testFile, search: 'Hello', replacement: 'Hi' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Reemplazadas 2 ocurrencia');

      // Verify file content
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('Hi world');
      expect(content).toContain('Hi universe');
      expect(content).not.toContain('Hello');
    });

    it('should fail if search text not found', async () => {
      // Create test file
      writeFileSync(testFile, 'Hello world', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'reemplazá "Goodbye" por "Hi" en test-edit.txt',
        intent: 'text_replace',
        params: { filePath: testFile, search: 'Goodbye', replacement: 'Hi' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No se encontró');
    });

    it('should handle special regex characters', async () => {
      // Create test file
      writeFileSync(testFile, 'Price: $10.00', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'reemplazá "$10.00" por "$20.00" en test-edit.txt',
        intent: 'text_replace',
        params: { filePath: testFile, search: '$10.00', replacement: '$20.00' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);

      // Verify file content
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('$20.00');
      expect(content).not.toContain('$10.00');
    });
  });

  describe('text_delete', () => {
    it('should delete lines containing phrase', async () => {
      // Create test file
      writeFileSync(testFile, 'Keep this line\nDelete this line\nKeep this too\nDelete this also', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'eliminá la línea "Delete" de test-edit.txt',
        intent: 'text_delete',
        params: { filePath: testFile, phrase: 'Delete' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Eliminadas 2 línea');

      // Verify file content
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toContain('Keep this line');
      expect(content).toContain('Keep this too');
      expect(content).not.toContain('Delete');
    });

    it('should fail if phrase not found', async () => {
      // Create test file
      writeFileSync(testFile, 'Line 1\nLine 2', 'utf-8');

      const context: SkillContext = {
        rawCommand: 'eliminá la línea "NotFound" de test-edit.txt',
        intent: 'text_delete',
        params: { filePath: testFile, phrase: 'NotFound' },
      };

      const result = await skill.execute(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No se encontró');
    });
  });
});
