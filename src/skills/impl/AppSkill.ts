/**
 * AppSkill.ts — Skill para abrir, cerrar, enfocar y minimizar aplicaciones
 *
 * Envuelve los módulos existentes:
 *   - open_app_by_name.ts  (abrir por nombre desde config/apps.json)
 *   - open_windows_app.ts  (apps hardcoded: chrome, notepad, etc.)
 *   - window_management.ts (cerrar, enfocar, minimizar)
 */

import { openAppByName }    from '../open_app_by_name.js';
import { closeAppByName, focusAppByName, minimizeAppByName, listRunningApps } from '../window_management.js';
import { openCalculator, openNotepad, openChrome, openVSCode, openSteam, openDiscord } from '../open_windows_app.js';
import { isWindows, isLinux, runCommand } from '../utils/OsAdapter.js';

import type { Skill, SkillResult, SkillContext } from '../Skill.js';

/**
 * Helper to run a shell command
 * Ignores non-zero exit codes except for ENOENT (command not found)
 */
async function runShellCommand(cmd: string): Promise<void> {
  try {
    await runCommand(cmd);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw error;
    }
    // Ignore other errors
  }
}

export class AppSkill implements Skill {
  readonly name = 'app';
  readonly description = 'Abre, cierra, enfoca y minimiza aplicaciones del sistema';
  readonly riskLevel = 'low' as const;
  readonly supportedIntents = [
    'open_app',
    'close_app',
    'focus_app',
    'minimize_app',
    'list_running_apps',
  ];

  validate(context: SkillContext): string | null {
    const needsAppName = ['open_app', 'close_app', 'focus_app', 'minimize_app'];
    // list_running_apps no necesita parámetros
    if (needsAppName.includes(context.intent)) {
      if (!context.params.appName || typeof context.params.appName !== 'string') {
        return 'Se requiere el nombre de la aplicación';
      }
    }
    return null;
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, params } = context;
    
    switch (intent) {
      case 'open_app':
        return this.openApp(String(params.appName ?? ''));

      case 'close_app': {
        const r = await closeAppByName(String(params.appName ?? ''));
        return { success: r.success, message: r.message, error: r.error };
      }

      case 'focus_app': {
        const r = await focusAppByName(String(params.appName ?? ''));
        return { success: r.success, message: r.message, error: r.error };
      }

      case 'minimize_app': {
        const r = await minimizeAppByName(String(params.appName ?? ''));
        return { success: r.success, message: r.message, error: r.error };
      }

      case 'list_running_apps': {
        const r = await listRunningApps();
        return { success: r.success, message: r.message, data: r.apps, error: r.error };
      }

      default:
        return { success: false, message: `Intent desconocido: ${intent}` };
    }
  }

  // ── Lógica de apertura con fallback ─────────────────────────────────────────

  private async openApp(appName: string): Promise<SkillResult> {
    if (!appName) {
      return { success: false, message: 'Se requiere el nombre de la aplicación' };
    }

    const normalized = appName.toLowerCase().trim();

    // Intentar primero con apps hardcoded (más confiable)
    const hardcoded = await this.tryHardcoded(normalized);
    if (hardcoded !== null) return hardcoded;

    // Fallback: buscar en config/apps.json
    const result = await openAppByName(appName);
    return { success: result.success, message: result.message, error: result.error };
  }

  /**
   * Helper to try Linux alternatives in sequence
   * Tries each command until one succeeds
   */
  private async tryLinuxAlternatives(
    alternatives: string[],
    successMessage: string
  ): Promise<SkillResult> {
    for (const alt of alternatives) {
      try {
        await runCommand(`nohup ${alt} > /dev/null 2>&1 &`);
        return { success: true, message: successMessage };
      } catch {
        continue;
      }
    }
    return { success: false, message: 'No pude abrir la aplicación' };
  }

  private async tryHardcoded(name: string): Promise<SkillResult | null> {
    const chromePhrases  = ['chrome', 'google chrome', 'chromium'];
    const vscodePhrases  = ['vscode', 'vs code', 'visual studio code', 'code'];
    const notepadPhrases = ['notepad', 'bloc de notas', 'bloc', 'editor', 'text editor'];
    const calcPhrases    = ['calculator', 'calculadora', 'calc'];
    const steamPhrases   = ['steam'];
    const discordPhrases = ['discord'];
    const whatsappPhrases = ['whatsapp'];
    const settingsPhrases = ['settings', 'configuración', 'configuracion', 'ajustes', 'panel de control'];
    const explorerPhrases = ['explorador', 'explorer', 'archivos', 'file manager', 'files'];
    const taskMgrPhrases  = ['administrador de tareas', 'task manager', 'taskmgr', 'system monitor'];
    const terminalPhrases = ['terminal', 'consola', 'console', 'cmd', 'command prompt'];

    let result;
    if (chromePhrases.some(p => name.includes(p))) {
      result = await openChrome();
    } else if (vscodePhrases.some(p => name.includes(p))) {
      result = await openVSCode();
    } else if (notepadPhrases.some(p => name.includes(p))) {
      result = await openNotepad();
    } else if (calcPhrases.some(p => name.includes(p))) {
      result = await openCalculator();
    } else if (steamPhrases.some(p => name.includes(p))) {
      result = await openSteam();
    } else if (discordPhrases.some(p => name.includes(p))) {
      result = await openDiscord();
    } else if (whatsappPhrases.some(p => name.includes(p))) {
      // WhatsApp Desktop
      try {
        if (isWindows()) {
          await runShellCommand('start whatsapp:');
        } else if (isLinux()) {
          await runShellCommand('nohup whatsapp-for-linux > /dev/null 2>&1 &');
        }
        return { success: true, message: 'Abrí WhatsApp' };
      } catch (error) {
        return { success: false, message: 'No pude abrir WhatsApp', error: error instanceof Error ? error.message : 'unknown' };
      }
    } else if (settingsPhrases.some(p => name.includes(p))) {
      // System Settings
      if (isWindows()) {
        try {
          await runShellCommand('start ms-settings:');
          return { success: true, message: 'Abrí la Configuración del Sistema' };
        } catch (error) {
          return { success: false, message: 'No pude abrir la Configuración', error: error instanceof Error ? error.message : 'unknown' };
        }
      } else if (isLinux()) {
        return await this.tryLinuxAlternatives(
          ['budgie-control-center', 'gnome-control-center', 'systemsettings5'],
          'Abrí la Configuración del Sistema'
        );
      }
      return { success: false, message: 'No pude abrir la Configuración' };
    } else if (explorerPhrases.some(p => name.includes(p))) {
      // File Explorer/Manager
      try {
        if (isWindows()) {
          await runShellCommand('explorer.exe');
        } else if (isLinux()) {
          // Use nemo (confirmed available on this system)
          await runShellCommand('nohup nemo > /dev/null 2>&1 &');
        }
        return { success: true, message: 'Abrí el Explorador de Archivos' };
      } catch (error) {
        return { success: false, message: 'No pude abrir el Explorador', error: error instanceof Error ? error.message : 'unknown' };
      }
    } else if (taskMgrPhrases.some(p => name.includes(p))) {
      // Task Manager / System Monitor
      if (isWindows()) {
        try {
          await runShellCommand('taskmgr.exe');
          return { success: true, message: 'Abrí el Monitor del Sistema' };
        } catch (error) {
          return { success: false, message: 'No pude abrir el Monitor del Sistema', error: error instanceof Error ? error.message : 'unknown' };
        }
      } else if (isLinux()) {
        return await this.tryLinuxAlternatives(
          ['gnome-system-monitor', 'ksysguard'],
          'Abrí el Monitor del Sistema'
        );
      }
      return { success: false, message: 'No pude abrir el Monitor del Sistema' };
    } else if (terminalPhrases.some(p => name.includes(p))) {
      // Terminal
      if (isWindows()) {
        try {
          await runShellCommand('start cmd.exe');
          return { success: true, message: 'Abrí la Terminal' };
        } catch (error) {
          return { success: false, message: 'No pude abrir la Terminal', error: error instanceof Error ? error.message : 'unknown' };
        }
      } else if (isLinux()) {
        return await this.tryLinuxAlternatives(
          ['tilix', 'x-terminal-emulator', 'gnome-terminal'],
          'Abrí la Terminal'
        );
      }
      return { success: false, message: 'No pude abrir la Terminal' };
    } else {
      return null; // no match hardcoded
    }

    return { success: result.success, message: result.message, error: result.error };
  }
}
