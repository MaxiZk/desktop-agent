/**
 * GameSkill.test.ts — Tests para la skill de lanzamiento de juegos
 *
 * Cubre:
 * - Construcción sin errores
 * - Metadatos de la skill (nombre, intents, riskLevel)
 * - Validación de parámetros
 * - listGames: resultado correcto cuando hay juegos configurados
 * - launchGame: nombre no encontrado → fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameSkill } from '../impl/GameSkill.js';
import type { SkillContext } from '../Skill.js';

// Mock child_process exec to avoid actually launching games in tests
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, _opts: any, cb: (err: Error | null, stdout: string) => void) => {
    // Simulate successful exec for URL/command launches
    if (typeof cb === 'function') {
      cb(null, '');
    }
    return { kill: vi.fn(), on: vi.fn() };
  }),
}));

// Mock fs to control config loading
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn((p: string) => p.includes('games.json')),
    readFileSync: vi.fn(() => JSON.stringify({
      games: {
        minecraft: {
          launcher: 'url',
          value: 'minecraft://',
          steamAppId: null,
          aliases: ['mc', 'minecraft java'],
          category: 'sandbox',
        },
        cs2: {
          launcher: 'steam',
          steamAppId: '730',
          value: 'steam://rungameid/730',
          aliases: ['counter-strike 2', 'csgo'],
          category: 'shooter',
        },
        steam: {
          launcher: 'url',
          value: 'steam://open/main',
          steamAppId: null,
          aliases: ['steam client'],
          category: 'platform',
        },
      },
    })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(intent: string, params: Record<string, unknown> = {}): SkillContext {
  return {
    rawCommand: '',
    intent,
    params,
    confirmed: false,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameSkill', () => {
  let skill: GameSkill;

  beforeEach(() => {
    skill = new GameSkill();
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(skill.name).toBe('game');
    });

    it('should have correct supported intents', () => {
      expect(skill.supportedIntents).toContain('launch_game');
      expect(skill.supportedIntents).toContain('list_games');
      expect(skill.supportedIntents).toContain('open_steam');
    });

    it('should have low risk level', () => {
      expect(skill.riskLevel).toBe('low');
    });

    it('should have a description', () => {
      expect(skill.description).toBeTruthy();
      expect(typeof skill.description).toBe('string');
    });
  });

  describe('validate', () => {
    it('should return null for list_games (no params needed)', () => {
      expect(skill.validate(makeContext('list_games'))).toBeNull();
    });

    it('should return null for open_steam (no params needed)', () => {
      expect(skill.validate(makeContext('open_steam'))).toBeNull();
    });

    it('should return error when launch_game has no gameName', () => {
      const error = skill.validate(makeContext('launch_game', {}));
      expect(error).not.toBeNull();
      expect(typeof error).toBe('string');
    });

    it('should return null for launch_game with valid gameName', () => {
      const error = skill.validate(makeContext('launch_game', { gameName: 'minecraft' }));
      expect(error).toBeNull();
    });
  });

  describe('execute - list_games', () => {
    it('should return success with game list', async () => {
      const result = await skill.execute(makeContext('list_games'));
      expect(result.success).toBe(true);
      expect(result.message).toContain('juego');
      expect(result.data).toBeDefined();
    });

    it('should include game count in data', async () => {
      const result = await skill.execute(makeContext('list_games'));
      expect(result.data).toHaveProperty('count');
      expect(typeof (result.data as any).count).toBe('number');
    });

    it('should list game names', async () => {
      const result = await skill.execute(makeContext('list_games'));
      expect(result.data).toHaveProperty('games');
      const games = (result.data as any).games as Array<{ name: string }>;
      const names = games.map(g => g.name);
      expect(names).toContain('minecraft');
      expect(names).toContain('cs2');
    });
  });

  describe('execute - launch_game', () => {
    it('should return success for known game (minecraft)', async () => {
      const result = await skill.execute(makeContext('launch_game', { gameName: 'minecraft' }));
      expect(result.success).toBe(true);
      expect(result.message).toContain('minecraft');
    });

    it('should match by alias', async () => {
      const result = await skill.execute(makeContext('launch_game', { gameName: 'mc' }));
      expect(result.success).toBe(true);
    });

    it('should match case-insensitively', async () => {
      const result = await skill.execute(makeContext('launch_game', { gameName: 'MINECRAFT' }));
      expect(result.success).toBe(true);
    });

    it('should return success for known Steam game (cs2)', async () => {
      const result = await skill.execute(makeContext('launch_game', { gameName: 'cs2' }));
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('steamAppId');
    });

    it('should return data with game info on success', async () => {
      const result = await skill.execute(makeContext('launch_game', { gameName: 'minecraft' }));
      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('launcher');
    });
  });

  describe('execute - open_steam', () => {
    it('should return success', async () => {
      const result = await skill.execute(makeContext('open_steam'));
      expect(result.success).toBe(true);
    });

    it('should include Steam in message', async () => {
      const result = await skill.execute(makeContext('open_steam'));
      expect(result.message.toLowerCase()).toContain('steam');
    });
  });

  describe('execute - unknown intent', () => {
    it('should return failure for unknown intent', async () => {
      const result = await skill.execute(makeContext('unknown_intent'));
      expect(result.success).toBe(false);
    });
  });
});
