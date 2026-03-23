/**
 * archive_operations.ts — Operaciones con archivos comprimidos
 *
 * Soporta operaciones cross-platform usando herramientas del sistema:
 *   - list:    lista el contenido de un archivo (zip/tar/gz)
 *   - extract: extrae un archivo comprimido a un directorio destino
 *   - create:  crea un archivo zip a partir de archivos/directorios
 *
 * Windows:  usa PowerShell Expand-Archive / Compress-Archive
 * Linux:    usa unzip / zip / tar según el tipo de archivo
 */

import { exec } from 'child_process';
import { existsSync } from 'fs';
import { extname, basename, dirname, join, resolve } from 'path';

export interface ArchiveResult {
  success: boolean;
  message: string;
  data?: {
    archivePath?: string;
    destPath?: string;
    entries?: string[];
    entryCount?: number;
  };
  error?: string;
}

type ArchiveType = 'zip' | 'tar' | 'tar.gz' | 'tar.bz2' | 'rar' | 'unknown';

// ── Helpers ───────────────────────────────────────────────────────────────────

function execCmd(cmd: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { windowsHide: true, maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('exit', () => clearTimeout(timer));
  });
}

function detectArchiveType(filePath: string): ArchiveType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2';
  if (lower.endsWith('.tar')) return 'tar';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.rar')) return 'rar';
  return 'unknown';
}

const isWindows = process.platform === 'win32';

// ── List Archive ─────────────────────────────────────────────────────────────

/**
 * Lists the contents of a compressed archive.
 */
export async function listArchive(archivePath: string): Promise<ArchiveResult> {
  const absolutePath = resolve(archivePath);

  if (!existsSync(absolutePath)) {
    return {
      success: false,
      message: `El archivo no existe: ${archivePath}`,
      error: 'File not found',
    };
  }

  const archiveType = detectArchiveType(absolutePath);

  try {
    let output: string;

    if (isWindows) {
      switch (archiveType) {
        case 'zip':
          // PowerShell: open as zip and list
          output = await execCmd(
            `powershell -NoProfile -Command "Add-Type -A System.IO.Compression.FileSystem; ` +
            `[IO.Compression.ZipFile]::OpenRead('${absolutePath}').Entries | Select-Object -ExpandProperty FullName"`
          );
          break;
        case 'tar':
        case 'tar.gz':
        case 'tar.bz2':
          output = await execCmd(`tar -tf "${absolutePath}"`);
          break;
        default:
          return {
            success: false,
            message: `Formato de archivo no soportado: ${extname(absolutePath)}`,
          };
      }
    } else {
      // Linux / macOS
      switch (archiveType) {
        case 'zip':
          output = await execCmd(`unzip -l "${absolutePath}" | awk 'NR>3 && NF>=4 {print $NF}' | head -100`);
          break;
        case 'tar':
          output = await execCmd(`tar -tf "${absolutePath}"`);
          break;
        case 'tar.gz':
          output = await execCmd(`tar -tzf "${absolutePath}"`);
          break;
        case 'tar.bz2':
          output = await execCmd(`tar -tjf "${absolutePath}"`);
          break;
        case 'rar':
          output = await execCmd(`unrar l "${absolutePath}" | awk '/^---/{p=!p;next}p{print $NF}'`);
          break;
        default:
          return {
            success: false,
            message: `Formato de archivo no soportado: ${extname(absolutePath)}`,
          };
      }
    }

    const entries = output
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    return {
      success: true,
      message: `📦 ${basename(absolutePath)} contiene ${entries.length} elemento(s):\n${entries.slice(0, 20).join('\n')}${entries.length > 20 ? `\n... y ${entries.length - 20} más` : ''}`,
      data: { archivePath: absolutePath, entries, entryCount: entries.length },
    };
  } catch (error) {
    return {
      success: false,
      message: `No pude leer el archivo: ${basename(archivePath)}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ── Extract Archive ───────────────────────────────────────────────────────────

/**
 * Extracts a compressed archive to a destination directory.
 * If destPath is not provided, extracts next to the archive file.
 */
export async function extractArchive(
  archivePath: string,
  destPath?: string
): Promise<ArchiveResult> {
  const absoluteArchive = resolve(archivePath);

  if (!existsSync(absoluteArchive)) {
    return {
      success: false,
      message: `El archivo no existe: ${archivePath}`,
      error: 'File not found',
    };
  }

  const archiveName = basename(absoluteArchive, extname(absoluteArchive))
    .replace('.tar', ''); // Handle double extensions like .tar.gz
  const destination = destPath
    ? resolve(destPath)
    : join(dirname(absoluteArchive), archiveName);

  const archiveType = detectArchiveType(absoluteArchive);

  try {
    if (isWindows) {
      switch (archiveType) {
        case 'zip':
          await execCmd(
            `powershell -NoProfile -Command "Expand-Archive -Path '${absoluteArchive}' -DestinationPath '${destination}' -Force"`
          );
          break;
        case 'tar':
        case 'tar.gz':
        case 'tar.bz2':
          await execCmd(`tar -xf "${absoluteArchive}" -C "${destination}"`);
          break;
        default:
          return {
            success: false,
            message: `Formato de archivo no soportado en Windows: ${extname(absoluteArchive)}`,
          };
      }
    } else {
      // Linux / macOS
      switch (archiveType) {
        case 'zip':
          await execCmd(`unzip -o "${absoluteArchive}" -d "${destination}"`);
          break;
        case 'tar':
          await execCmd(`mkdir -p "${destination}" && tar -xf "${absoluteArchive}" -C "${destination}"`);
          break;
        case 'tar.gz':
          await execCmd(`mkdir -p "${destination}" && tar -xzf "${absoluteArchive}" -C "${destination}"`);
          break;
        case 'tar.bz2':
          await execCmd(`mkdir -p "${destination}" && tar -xjf "${absoluteArchive}" -C "${destination}"`);
          break;
        case 'rar':
          await execCmd(`mkdir -p "${destination}" && unrar x "${absoluteArchive}" "${destination}/"`);
          break;
        default:
          return {
            success: false,
            message: `Formato de archivo no soportado: ${extname(absoluteArchive)}`,
          };
      }
    }

    return {
      success: true,
      message: `✅ Extraído "${basename(absoluteArchive)}" en: ${destination}`,
      data: { archivePath: absoluteArchive, destPath: destination },
    };
  } catch (error) {
    return {
      success: false,
      message: `No pude extraer "${basename(archivePath)}". ¿Está instalado unzip/tar?`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ── Create Archive ────────────────────────────────────────────────────────────

/**
 * Creates a zip archive from files or directories.
 * @param outputPath  - path for the new zip file (must end in .zip)
 * @param sourcePaths - array of files or directories to include
 */
export async function createArchive(
  outputPath: string,
  sourcePaths: string[]
): Promise<ArchiveResult> {
  if (!sourcePaths || sourcePaths.length === 0) {
    return {
      success: false,
      message: 'Se requiere al menos un archivo o directorio a comprimir',
    };
  }

  const absoluteOutput = resolve(outputPath);
  const absoluteSources = sourcePaths.map(p => resolve(p));

  // Validate sources exist
  for (const src of absoluteSources) {
    if (!existsSync(src)) {
      return {
        success: false,
        message: `El archivo o directorio no existe: ${src}`,
        error: 'Source not found',
      };
    }
  }

  const sourceList = absoluteSources.map(p => `"${p}"`).join(' ');

  try {
    if (isWindows) {
      if (absoluteSources.length === 1) {
        await execCmd(
          `powershell -NoProfile -Command "Compress-Archive -Path '${absoluteSources[0]}' -DestinationPath '${absoluteOutput}' -Force"`
        );
      } else {
        // Multiple sources: create with first, update with rest
        await execCmd(
          `powershell -NoProfile -Command "Compress-Archive -Path ${absoluteSources.map(p => `'${p}'`).join(',')} -DestinationPath '${absoluteOutput}' -Force"`
        );
      }
    } else {
      // Use zip on Linux/macOS
      const sourceNames = absoluteSources.map(p => `"${p}"`).join(' ');
      await execCmd(`zip -r "${absoluteOutput}" ${sourceNames}`);
    }

    return {
      success: true,
      message: `✅ Archivo comprimido creado: ${basename(absoluteOutput)}`,
      data: { archivePath: absoluteOutput },
    };
  } catch (error) {
    return {
      success: false,
      message: `No pude crear el archivo comprimido: ${basename(outputPath)}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
