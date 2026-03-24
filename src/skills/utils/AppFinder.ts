/**
 * AppFinder.ts — Sistema de búsqueda y lanzamiento de aplicaciones
 * 
 * Busca aplicaciones en el sistema usando múltiples estrategias:
 * 1. PATH lookup (cross-platform)
 * 2. Windows Program Files search
 * 2b. Linux .desktop file discovery
 * 3. Linux bin search
 * 4. Windows shell launch attempt
 */

import { exec, execSync } from 'child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

export interface AppLaunchResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching app names
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Ejecuta un comando y devuelve el resultado con timeout
 */
function execCommand(command: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(command, { windowsHide: true }, (error, stdout, _stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });

    // Timeout protection
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Command timeout'));
    }, timeoutMs);

    child.on('exit', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Busca archivos recursivamente con límite de profundidad
 */
function searchFiles(
  dir: string,
  pattern: string,
  maxDepth: number,
  currentDepth = 0
): string | null {
  if (currentDepth >= maxDepth) return null;
  if (!existsSync(dir)) return null;

  try {
    const entries = readdirSync(dir);

    // Buscar en el directorio actual
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isFile()) {
          if (entry.toLowerCase() === pattern.toLowerCase()) {
            return fullPath;
          }
        } else if (stat.isDirectory()) {
          // Buscar recursivamente
          const found = searchFiles(fullPath, pattern, maxDepth, currentDepth + 1);
          if (found) return found;
        }
      } catch {
        // Ignorar errores de permisos
        continue;
      }
    }
  } catch {
    // Ignorar errores de lectura de directorio
    return null;
  }

  return null;
}

/**
 * STRATEGY 1: PATH lookup (cross-platform)
 */
async function tryPathLookup(appName: string): Promise<AppLaunchResult | null> {
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? `where ${appName}` : `which ${appName}`;
    
    const result = await execCommand(command);
    
    if (result) {
      // Encontrado en PATH, intentar lanzar
      const launchCommand = isWindows 
        ? `start "" "${result.split('\n')[0]}"` 
        : `nohup "${result}" &`;
      
      await execCommand(launchCommand);
      
      console.log(`[AppFinder] Strategy 1 (PATH lookup) succeeded: ${appName}`);
      return {
        success: true,
        message: `Abrí ${appName}`,
      };
    }
  } catch {
    // No encontrado en PATH, continuar con siguiente estrategia
  }
  
  return null;
}

/**
 * STRATEGY 2b: Linux .desktop file discovery
 * Searches for installed apps via .desktop files in standard locations
 * Now with fuzzy matching support
 */
async function findLinuxDesktopApp(appName: string): Promise<string | null> {
  if (process.platform !== 'linux') return null;

  const normalized = appName.toLowerCase().replace(/\s+/g, '');
  
  try {
    // Search all .desktop files in standard locations including Flatpak
    const dirs = [
      '/usr/share/applications',
      '/usr/local/share/applications',
      `${process.env.HOME}/.local/share/applications`,
      '/var/lib/flatpak/exports/share/applications',
      `${process.env.HOME}/.local/share/flatpak/exports/share/applications`,
    ];

    let bestMatch: { file: string; exec: string; distance: number } | null = null;

    for (const dir of dirs) {
      try {
        const files = execSync(`ls ${dir}/*.desktop 2>/dev/null`, { encoding: 'utf-8' })
          .trim()
          .split('\n')
          .filter(f => f.length > 0);

        for (const file of files) {
          try {
            const content = readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            
            // Extract Name= and Exec= from .desktop file
            const nameLine = lines.find(l => l.startsWith('Name='));
            const execLine = lines.find(l => l.startsWith('Exec='));
            
            if (!nameLine || !execLine) continue;
            
            const appNameFromFile = nameLine.replace('Name=', '').trim().toLowerCase();
            const execCommand = execLine
              .replace('Exec=', '')
              .split(' ')[0]
              .replace(/%[uUfFdDnNickvm]/g, '')
              .trim();
            
            if (!execCommand) continue;
            
            // Calculate fuzzy match distance
            const distance = levenshteinDistance(normalized, appNameFromFile.replace(/\s+/g, ''));
            
            // Accept if distance <= 2 (allows for minor typos)
            if (distance <= 2) {
              if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { file, exec: execCommand, distance };
              }
            }
            
            // Also check filename match
            const filename = file.split('/').pop()?.replace('.desktop', '').toLowerCase() ?? '';
            if (filename.includes(normalized) || normalized.includes(filename.split('-')[0])) {
              if (!bestMatch || 0 < bestMatch.distance) {
                bestMatch = { file, exec: execCommand, distance: 0 };
              }
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    if (bestMatch) {
      console.log(`[AppFinder] Found .desktop file: ${bestMatch.file} -> ${bestMatch.exec} (distance: ${bestMatch.distance})`);
      return bestMatch.exec;
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * STRATEGY 2c: Linux gtk-launch (uses .desktop files directly)
 */
async function tryLinuxGtkLaunch(appName: string): Promise<AppLaunchResult | null> {
  if (process.platform !== 'linux') return null;

  try {
    const result = execSync(
      `ls /usr/share/applications/ | grep -i "${appName}" | head -1`,
      { encoding: 'utf-8' }
    ).trim().replace('.desktop', '');

    if (result) {
      await execCommand(`gtk-launch "${result}" &`);
      console.log(`[AppFinder] Strategy 2c (gtk-launch) succeeded: ${appName}`);
      return {
        success: true,
        message: `Abrí ${appName}`,
      };
    }
  } catch {
    // gtk-launch failed
  }

  return null;
}
/**
 * STRATEGY 2: Windows Program Files search
 */
async function tryWindowsProgramFiles(appName: string): Promise<AppLaunchResult | null> {
  if (process.platform !== 'win32') return null;

  const searchDirs = [
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ];

  // Agregar LOCALAPPDATA\Programs si existe
  if (process.env.LOCALAPPDATA) {
    searchDirs.push(join(process.env.LOCALAPPDATA, 'Programs'));
  }

  const exeName = appName.endsWith('.exe') ? appName : `${appName}.exe`;

  for (const dir of searchDirs) {
    const found = searchFiles(dir, exeName, 3);
    
    if (found && existsSync(found)) {
      try {
        await execCommand(`start "" "${found}"`);
        
        console.log(`[AppFinder] Strategy 2 (Program Files) succeeded: ${found}`);
        return {
          success: true,
          message: `Abrí ${appName}`,
        };
      } catch (error) {
        // Error al lanzar, continuar buscando
        continue;
      }
    }
  }

  return null;
}

/**
 * STRATEGY 3: Linux bin search (including Snap)
 */
async function tryLinuxBinSearch(appName: string): Promise<AppLaunchResult | null> {
  if (process.platform !== 'linux') return null;

  const searchDirs = ['/usr/bin', '/usr/local/bin', '/opt', '/snap/bin'];

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;

    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        if (entry.toLowerCase() === appName.toLowerCase() || 
            entry.toLowerCase().includes(appName.toLowerCase())) {
          const fullPath = join(dir, entry);
          
          if (existsSync(fullPath)) {
            try {
              await execCommand(`nohup "${fullPath}" &`);
              
              console.log(`[AppFinder] Strategy 3 (Linux bin) succeeded: ${fullPath}`);
              return {
                success: true,
                message: `Abrí ${appName}`,
              };
            } catch {
              // Error al lanzar, continuar buscando
              continue;
            }
          }
        }
      }
    } catch {
      // Error al leer directorio, continuar
      continue;
    }
  }

  return null;
}

/**
 * STRATEGY 4: Windows shell launch attempt
 */
async function tryWindowsShellLaunch(appName: string): Promise<AppLaunchResult | null> {
  if (process.platform !== 'win32') return null;

  try {
    await execCommand(`start "" ${appName}`);
    
    console.log(`[AppFinder] Strategy 4 (Windows shell) succeeded: ${appName}`);
    return {
      success: true,
      message: `Abrí ${appName}`,
    };
  } catch {
    // Falló el intento de shell
  }

  return null;
}

/**
 * Busca y lanza una aplicación usando múltiples estrategias
 */
export async function findAndLaunchApp(appName: string): Promise<AppLaunchResult> {
  console.log(`[AppFinder] Searching for app: ${appName}`);

  // Validación básica
  if (!appName || appName.trim().length === 0) {
    return {
      success: false,
      message: 'El nombre de la aplicación no puede estar vacío',
    };
  }

  // Intentar estrategias en orden según la plataforma
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  // Strategy order:
  // 1. PATH lookup (all platforms)
  // 2. Windows: Program Files search, then shell launch
  // 2b. Linux: .desktop file discovery, gtk-launch, then bin search
  const strategies = [
    tryPathLookup,
    ...(isWindows ? [tryWindowsProgramFiles, tryWindowsShellLaunch] : []),
    ...(isLinux ? [] : []),
  ];

  for (const strategy of strategies) {
    const result = await strategy(appName);
    if (result) {
      return result;
    }
  }

  // Linux-specific: try .desktop file discovery
  if (isLinux) {
    const desktopExec = await findLinuxDesktopApp(appName);
    if (desktopExec) {
      try {
        await execCommand(`nohup ${desktopExec} > /dev/null 2>&1 &`);
        console.log(`[AppFinder] Strategy 2b (.desktop) succeeded: ${appName}`);
        return {
          success: true,
          message: `Abrí ${appName}`,
        };
      } catch {
        // Continue to next strategy
      }
    }

    // Try gtk-launch
    const gtkResult = await tryLinuxGtkLaunch(appName);
    if (gtkResult) {
      return gtkResult;
    }

    // Try bin search
    const binResult = await tryLinuxBinSearch(appName);
    if (binResult) {
      return binResult;
    }
  }

  // Todas las estrategias fallaron
  console.log(`[AppFinder] All strategies failed for: ${appName}`);
  return {
    success: false,
    message: `No encontré "${appName}". ¿Está instalada en tu PC?`,
  };
}
