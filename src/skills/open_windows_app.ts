import { isWindows, isLinux, runCommand, isProcessRunning } from "./utils/OsAdapter.js";

export interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}

async function execCommand(command: string): Promise<void> {
  await runCommand(command);
}

export async function openNotepad(): Promise<CommandResult> {
  try {
    const processName = isWindows() ? "notepad.exe" : "gedit";
    const alreadyOpen = await isProcessRunning(processName);

    if (alreadyOpen) {
      return {
        success: true,
        message: "El Bloc de Notas ya estaba abierto",
      };
    }

    if (isWindows()) {
      await execCommand(`start "" notepad.exe`);
    } else if (isLinux()) {
      // Try gedit, then nano, then vim
      try {
        await execCommand(`nohup gedit > /dev/null 2>&1 &`);
      } catch {
        try {
          await execCommand(`nohup xdg-terminal -- nano &`);
        } catch {
          await execCommand(`nohup xdg-terminal -- vim &`);
        }
      }
    }

    return {
      success: true,
      message: "Abrí el Bloc de Notas",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir el Bloc de Notas",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openCalculator(): Promise<CommandResult> {
  try {
    // On Linux, skip process check and just try to open
    // Calculator apps may not show as separate processes
    if (!isWindows()) {
      try {
        await execCommand(`nohup mate-calc > /dev/null 2>&1 &`);
      } catch {
        try {
          await execCommand(`nohup gnome-calculator > /dev/null 2>&1 &`);
        } catch {
          try {
            await execCommand(`nohup qalculate-gtk > /dev/null 2>&1 &`);
          } catch {
            await execCommand(`nohup kcalc > /dev/null 2>&1 &`);
          }
        }
      }
      return {
        success: true,
        message: "Abrí la Calculadora",
      };
    }

    // Windows: check if already running
    const processName = "CalculatorApp.exe";
    const alreadyOpen = await isProcessRunning(processName);

    if (alreadyOpen) {
      return {
        success: true,
        message: "La Calculadora ya estaba abierta",
      };
    }

    try {
      await execCommand(
        `explorer.exe shell:AppsFolder\\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`
      );
    } catch {
      await execCommand(`start "" calc.exe`);
    }

    return {
      success: true,
      message: "Abrí la Calculadora",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir la Calculadora",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openChrome(): Promise<CommandResult> {
  try {
    const processName = isWindows() ? "chrome.exe" : "chrome";
    const alreadyOpen = await isProcessRunning(processName);

    if (alreadyOpen) {
      return {
        success: true,
        message: "Chrome ya estaba abierto",
      };
    }

    if (isWindows()) {
      await execCommand(`start "" chrome`);
    } else if (isLinux()) {
      // Try google-chrome, then chromium-browser, then chromium
      try {
        await execCommand(`nohup google-chrome > /dev/null 2>&1 &`);
      } catch {
        try {
          await execCommand(`nohup chromium-browser > /dev/null 2>&1 &`);
        } catch {
          await execCommand(`nohup chromium > /dev/null 2>&1 &`);
        }
      }
    }

    return {
      success: true,
      message: "Abrí Chrome",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir Chrome",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openVSCode(): Promise<CommandResult> {
  try {
    const processName = isWindows() ? "Code.exe" : "code";
    const alreadyOpen = await isProcessRunning(processName);

    if (alreadyOpen) {
      return {
        success: true,
        message: "VS Code ya estaba abierto",
      };
    }

    if (isWindows()) {
      await execCommand(`start "" code`);
    } else if (isLinux()) {
      await execCommand(`nohup code > /dev/null 2>&1 &`);
    }

    return {
      success: true,
      message: "Abrí VS Code",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir VS Code",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openSteam(): Promise<CommandResult> {
  try {
    const alreadyOpen = await isProcessRunning("steam.exe");

    if (alreadyOpen) {
      return {
        success: true,
        message: "Steam ya estaba abierto",
      };
    }

    await execCommand(`start "" steam://open/main`);

    return {
      success: true,
      message: "Abrí Steam",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir Steam",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openDiscord(): Promise<CommandResult> {
  try {
    const alreadyOpen = await isProcessRunning("Discord.exe");

    if (alreadyOpen) {
      return {
        success: true,
        message: "Discord ya estaba abierto",
      };
    }

    await execCommand(`start "" discord://`);

    return {
      success: true,
      message: "Abrí Discord",
    };
  } catch (error) {
    return {
      success: false,
      message: "No pude abrir Discord",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}