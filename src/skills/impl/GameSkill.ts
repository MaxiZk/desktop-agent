/**
 * GameSkill.ts — Skill para lanzar y gestionar juegos
 *
 * Soporta operaciones:
 *   - launch_game: lanza un juego por nombre (Steam, Epic, etc.)
 *   - list_games: lista los juegos disponibles en la biblioteca
 *   - open_steam: abre el cliente de Steam
 *
 * Busca juegos en config/games.json y los lanza según su tipo:
 *   - steam:   usa URLs steam://rungameid/{appId}
 *   - url:     lanza una URL con xdg-open (Linux) o start (Windows)
 *   - command: ejecuta un comando del sistema
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import type { Skill, SkillResult, SkillContext } from '../Skill.js';

interface GameEntry {
  launcher: 'steam' | 'url' | 'command';
  value: string;
  steamAppId: string | null;
  aliases: string[];
  category: string;
}

interface GamesConfig {
  games: Record<string, GameEntry>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadGamesConfig(): GamesConfig {
  // Look for config/games.json relative to the project root
  const candidates = [
    join(process.cwd(), 'config', 'games.json'),
    join(process.cwd(), '..', 'config', 'games.json'),
    join(__dirname, '..', '..', '..', 'config', 'games.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf-8')) as GamesConfig;
      } catch {
        // Continue to next candidate
      }
    }
  }

  // Return empty config gracefully
  return { games: {} };
}

function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const isLinux   = process.platform === 'linux';
    const isMac     = process.platform === 'darwin';

    let cmd: string;
    if (isWindows) {
      cmd = `start "" "${url}"`;
    } else if (isMac) {
      cmd = `open "${url}"`;
    } else if (isLinux) {
      cmd = `xdg-open "${url}"`;
    } else {
      reject(new Error(`Unsupported platform: ${process.platform}`));
      return;
    }

    exec(cmd, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function openCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Finds a game entry in the config by matching name or alias (case-insensitive).
 */
function findGame(query: string, config: GamesConfig): [string, GameEntry] | null {
  const normalized = query.toLowerCase().trim();

  for (const [key, entry] of Object.entries(config.games)) {
    if (key === normalized || entry.aliases.some(a => a === normalized)) {
      return [key, entry];
    }
  }

  // Partial match fallback
  for (const [key, entry] of Object.entries(config.games)) {
    if (
      key.includes(normalized) ||
      normalized.includes(key) ||
      entry.aliases.some(a => a.includes(normalized) || normalized.includes(a))
    ) {
      return [key, entry];
    }
  }

  return null;
}

// ── GameSkill ─────────────────────────────────────────────────────────────────

export class GameSkill implements Skill {
  readonly name = 'game';
  readonly description = 'Lanza juegos y gestiona la biblioteca de juegos';
  readonly riskLevel = 'low' as const;
  readonly supportedIntents = ['launch_game', 'list_games', 'open_steam'];

  private config: GamesConfig;

  constructor() {
    this.config = loadGamesConfig();
  }

  validate(context: SkillContext): string | null {
    if (context.intent === 'launch_game') {
      if (!context.params.gameName || typeof context.params.gameName !== 'string') {
        return 'Se requiere el nombre del juego';
      }
    }
    return null;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    switch (context.intent) {
      case 'launch_game':
        return this.launchGame(String(context.params.gameName ?? ''));

      case 'list_games':
        return this.listGames();

      case 'open_steam':
        return this.openSteam();

      default:
        return { success: false, message: `Intent desconocido: ${context.intent}` };
    }
  }

  // ── Operaciones ─────────────────────────────────────────────────────────────

  private async launchGame(gameName: string): Promise<SkillResult> {
    if (!gameName) {
      return { success: false, message: 'Se requiere el nombre del juego' };
    }

    const match = findGame(gameName, this.config);

    if (!match) {
      // Try to open via Steam search as a last resort
      const steamSearchUrl = `steam://search/${encodeURIComponent(gameName)}`;
      try {
        await openUrl(steamSearchUrl);
        return {
          success: true,
          message: `No encontré "${gameName}" en la biblioteca, abrí Steam para buscarlo`,
        };
      } catch {
        return {
          success: false,
          message: `No encontré "${gameName}" en la biblioteca de juegos. ¿Está instalado?`,
        };
      }
    }

    const [key, entry] = match;
    const displayName = key.replace(/_/g, ' ');

    try {
      switch (entry.launcher) {
        case 'steam':
        case 'url':
          await openUrl(entry.value);
          break;
        case 'command':
          await openCommand(entry.value);
          break;
        default:
          return { success: false, message: `Tipo de lanzador desconocido: ${entry.launcher}` };
      }

      return {
        success: true,
        message: `🎮 Lanzando ${displayName}...`,
        data: {
          game: key,
          launcher: entry.launcher,
          category: entry.category,
          steamAppId: entry.steamAppId,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `No pude lanzar "${displayName}". ¿Está instalado?`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private listGames(): SkillResult {
    const games = Object.entries(this.config.games)
      .filter(([key]) => key !== 'steam' && key !== 'epic') // Exclude launchers
      .map(([key, entry]) => ({
        name: key.replace(/_/g, ' '),
        category: entry.category,
        launcher: entry.launcher,
        aliases: entry.aliases,
      }));

    if (games.length === 0) {
      return {
        success: true,
        message: 'No hay juegos configurados en la biblioteca.',
        data: { games: [] },
      };
    }

    const categories = [...new Set(games.map(g => g.category))];
    let message = `🎮 Biblioteca de juegos (${games.length} juegos):\n\n`;

    for (const cat of categories) {
      const catGames = games.filter(g => g.category === cat);
      message += `${cat.charAt(0).toUpperCase() + cat.slice(1)}:\n`;
      catGames.forEach(g => {
        message += `  - ${g.name}\n`;
      });
      message += '\n';
    }

    message += 'Para lanzar un juego: "jugá minecraft" o "lanzá cs2"';

    return {
      success: true,
      message: message.trim(),
      data: { games, count: games.length },
    };
  }

  private async openSteam(): Promise<SkillResult> {
    try {
      await openUrl('steam://open/main');
      return { success: true, message: '🎮 Abrí Steam' };
    } catch (error) {
      return {
        success: false,
        message: 'No pude abrir Steam. ¿Está instalado?',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
