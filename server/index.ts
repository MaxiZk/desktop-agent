/**
 * Express API Server
 * 
 * Provides REST API endpoints for the React frontend to safely access backend skills
 * without importing Node-only modules directly in the browser.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

console.log('[Claude] API key loaded:', !!process.env.ANTHROPIC_API_KEY ? 'YES' : 'NO - check .env file');

import express, { Request, Response } from 'express';
import cors from 'cors';
import { buildContext, parseCommand }    from '../src/skills/CommandRouter.js';
import { SkillRegistry }   from '../src/skills/SkillRegistry.js';
import { RiskGuard }       from '../src/skills/RiskGuard.js';
import { ExcelSkill }      from '../src/skills/impl/ExcelSkill.js';
import { AppSkill }        from '../src/skills/impl/AppSkill.js';
import { FileSkill }       from '../src/skills/impl/FileSkill.js';
import { SystemSkill }     from '../src/skills/impl/SystemSkill.js';
import { TextEditSkill }   from '../src/skills/impl/TextEditSkill.js';
import { narrateResult }   from '../src/skills/utils/NarratorService.js';
import { handleFreeForm }  from '../src/skills/utils/FreeFormHandler.js';
import { ContextBuilder }  from '../src/core/context/ContextBuilder.js';
import { SecurityGuard }   from '../src/core/security/SecurityGuard.js';
import { Allowlist }       from '../src/core/security/Allowlist.js';

import {
  openCalculator,
  openNotepad,
  openChrome,
  openVSCode,
  openSteam,
  openDiscord,
  readFile,
  readFileByPath,
  searchFiles,
  openFile,
  openFolder,
  analyzeCSV,
  generateAIResponse,
  saveMemory,
  loadMemory,
  saveCommandToHistory,
  getCommandHistory,
  openAppByName,
  getAvailableApps,
  getAppDetails,
  createExcelFile,
  readExcelFile,
  writeExcelFile,
  createWordFile,
  appendToWordFile,
  closeAppByName,
  listRunningApps,
  focusAppByName,
  minimizeAppByName,
  lockPC,
  requestShutdown,
  requestRestart,
  requestSleep,
  confirmSystemAction
} from '../src/backend/index.js';
import type { CommandHistoryEntry } from '../src/backend/index.js';
import {
  loadSessionHistory,
  saveSessionMessage,
  clearSessionHistory
} from '../src/memory/session_memory.js';
import {
  loadPreferences,
  savePreferences,
  updatePreference,
  type UserPreferences
} from '../src/memory/user_preferences.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, boolean>();

// Enable/disable narration via environment variable
const NARRATION_ENABLED = process.env.OLLAMA_NARRATION !== 'false';

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// AI status endpoint
app.get('/api/ai-status', (req: Request, res: Response) => {
  res.json({
    claude: !!process.env.ANTHROPIC_API_KEY,
    ollama: false // will be updated by frontend ping
  });
});

// Windows App Launcher endpoints
app.post('/api/open/calculator', async (req: Request, res: Response) => {
  const requestId = 'calculator';
  
  // Check if request is already in flight
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [Calculator] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'Calculator is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`🧮 [Calculator] Opening Calculator...`);
    
    const result = await openCalculator();
    
    console.log(`✅ [Calculator] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [Calculator] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Clear the in-flight flag after a short delay to prevent rapid duplicate clicks
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 1000);
  }
});

app.post('/api/open/notepad', async (req: Request, res: Response) => {
  const requestId = 'notepad';
  
  // Check if request is already in flight
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [Notepad] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'Notepad is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`📝 [Notepad] Opening Notepad...`);
    
    const result = await openNotepad();
    
    console.log(`✅ [Notepad] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [Notepad] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // Clear the in-flight flag after a short delay to prevent rapid duplicate clicks
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 2500);
  }
});

app.post('/api/open/chrome', async (req: Request, res: Response) => {
  const requestId = 'chrome';
  
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [Chrome] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'Chrome is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`🌐 [Chrome] Opening Chrome...`);
    
    const result = await openChrome();
    
    console.log(`✅ [Chrome] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [Chrome] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 2500);
  }
});

app.post('/api/open/vscode', async (req: Request, res: Response) => {
  const requestId = 'vscode';
  
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [VS Code] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'VS Code is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`💻 [VS Code] Opening VS Code...`);
    
    const result = await openVSCode();
    
    console.log(`✅ [VS Code] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [VS Code] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 2500);
  }
});

app.post('/api/open/steam', async (req: Request, res: Response) => {
  const requestId = 'steam';
  
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [Steam] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'Steam is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`🎮 [Steam] Opening Steam...`);
    
    const result = await openSteam();
    
    console.log(`✅ [Steam] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [Steam] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 2500);
  }
});

app.post('/api/open/discord', async (req: Request, res: Response) => {
  const requestId = 'discord';
  
  if (inFlightRequests.get(requestId)) {
    console.log(`⚠️  [Discord] Duplicate request blocked`);
    res.json({
      success: true,
      message: 'Discord is already being opened'
    });
    return;
  }
  
  try {
    inFlightRequests.set(requestId, true);
    console.log(`💬 [Discord] Opening Discord...`);
    
    const result = await openDiscord();
    
    console.log(`✅ [Discord] Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ [Discord] Error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    setTimeout(() => {
      inFlightRequests.delete(requestId);
    }, 2500);
  }
});

// File Reader endpoint
app.post('/api/read-file', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    const result = await readFile(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// File Reader by Path endpoint (for natural language commands)
app.post('/api/read-file-path', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      res.status(400).json({
        success: false,
        error: 'path is required'
      });
      return;
    }
    
    console.log(`📄 [File Reader] Reading file: ${path}`);
    
    const result = await readFileByPath(path);
    
    if (result.success) {
      console.log(`✅ [File Reader] File read successfully (${result.size} characters)`);
    } else {
      console.log(`❌ [File Reader] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [File Reader] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// File Search endpoint
app.post('/api/search-files', async (req: Request, res: Response) => {
  try {
    const { query, directory } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'query is required'
      });
      return;
    }
    
    console.log(`🔍 [File Search] Searching for: "${query}" in ${directory || 'Desktop'}`);
    
    const result = await searchFiles(query, directory);
    
    if (result.success) {
      console.log(`✅ [File Search] Found ${result.count} file(s)`);
    } else {
      console.log(`❌ [File Search] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [File Search] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Open File endpoint
app.post('/api/open-file', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      res.status(400).json({
        success: false,
        error: 'path is required'
      });
      return;
    }
    
    console.log(`📂 [Open File] Opening: ${path}`);
    
    const result = await openFile(path);
    
    if (result.success) {
      console.log(`✅ [Open File] File opened successfully`);
    } else {
      console.log(`❌ [Open File] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Open File] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Open Folder endpoint
app.post('/api/open-folder', async (req: Request, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      res.status(400).json({
        success: false,
        error: 'path is required'
      });
      return;
    }
    
    console.log(`📁 [Open Folder] Opening folder for: ${path}`);
    
    const result = await openFolder(path);
    
    if (result.success) {
      console.log(`✅ [Open Folder] Folder opened successfully: ${result.folderPath}`);
    } else {
      console.log(`❌ [Open Folder] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Open Folder] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Open App By Name endpoint
app.post('/api/open-app', async (req: Request, res: Response) => {
  try {
    const { appName } = req.body;
    
    if (!appName) {
      res.status(400).json({
        success: false,
        error: 'appName is required'
      });
      return;
    }
    
    console.log(`🚀 [Open App] Opening app: ${appName}`);
    
    const result = await openAppByName(appName);
    
    if (result.success) {
      console.log(`✅ [Open App] ${appName} opened successfully`);
    } else {
      console.log(`❌ [Open App] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Open App] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Available Apps endpoint
app.get('/api/available-apps', (req: Request, res: Response) => {
  try {
    const apps = getAvailableApps();
    res.json({
      success: true,
      apps,
      count: apps.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List App Details endpoint
app.get('/api/list-apps', (req: Request, res: Response) => {
  try {
    console.log(`📋 [List Apps] Fetching configured apps`);
    
    const appDetails = getAppDetails();
    
    console.log(`✅ [List Apps] Found ${appDetails.length} configured apps`);
    
    res.json({
      success: true,
      apps: appDetails,
      count: appDetails.length
    });
  } catch (error) {
    console.error(`❌ [List Apps] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// CSV Analyzer endpoint
app.post('/api/analyze-csv', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    const result = await analyzeCSV(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Excel Create endpoint
app.post('/api/excel/create', async (req: Request, res: Response) => {
  try {
    const { filePath, data, headers, autoOpen = true } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    console.log(`📊 [Excel Create] Creating Excel file: ${filePath}`);
    
    const result = await createExcelFile(filePath, data, headers, autoOpen);
    
    if (result.success) {
      console.log(`✅ [Excel Create] File created successfully: ${result.path}`);
      if (result.opened) {
        console.log(`📂 [Excel Create] File opened automatically`);
      }
    } else {
      console.log(`❌ [Excel Create] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Excel Create] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Excel Read endpoint
app.post('/api/excel/read', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    console.log(`📊 [Excel Read] Reading Excel file: ${filePath}`);
    
    const result = await readExcelFile(filePath);
    
    if (result.success) {
      console.log(`✅ [Excel Read] File read successfully: ${result.data?.length || 0} rows`);
    } else {
      console.log(`❌ [Excel Read] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Excel Read] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Excel Write endpoint
app.post('/api/excel/write', async (req: Request, res: Response) => {
  try {
    const { filePath, data, sheetName } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    if (!data || !Array.isArray(data)) {
      res.status(400).json({
        success: false,
        error: 'data array is required'
      });
      return;
    }
    
    console.log(`📊 [Excel Write] Writing Excel file: ${filePath}`);
    
    const result = await writeExcelFile(filePath, data, sheetName);
    
    if (result.success) {
      console.log(`✅ [Excel Write] File written successfully: ${result.path}`);
    } else {
      console.log(`❌ [Excel Write] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Excel Write] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Word Create endpoint
app.post('/api/word/create', async (req: Request, res: Response) => {
  try {
    const { filePath, content, title, autoOpen = true } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    console.log(`📝 [Word Create] Creating Word document: ${filePath}`);
    
    const result = await createWordFile(filePath, content, title, autoOpen);
    
    if (result.success) {
      console.log(`✅ [Word Create] Document created successfully: ${result.path}`);
      if (result.opened) {
        console.log(`📂 [Word Create] Document opened automatically`);
      }
    } else {
      console.log(`❌ [Word Create] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Word Create] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Word Append endpoint
app.post('/api/word/append', async (req: Request, res: Response) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath) {
      res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
      return;
    }
    
    if (!content) {
      res.status(400).json({
        success: false,
        error: 'content is required'
      });
      return;
    }
    
    console.log(`📝 [Word Append] Appending to Word document: ${filePath}`);
    
    const result = await appendToWordFile(filePath, content);
    
    if (result.success) {
      console.log(`✅ [Word Append] Content appended successfully: ${result.path}`);
    } else {
      console.log(`❌ [Word Append] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Word Append] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ollama AI endpoint
app.post('/api/ollama', async (req: Request, res: Response) => {
  try {
    const { prompt, model, stream } = req.body;
    
    if (!prompt) {
      res.status(400).json({
        success: false,
        error: 'prompt is required'
      });
      return;
    }
    
    const modelName = model || 'llama3.2:1b';
    console.log(`🤖 [Ollama] Generating response with model: ${modelName}`);
    console.log(`📝 [Ollama] Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);
    
    const result = await generateAIResponse(prompt, modelName, stream);
    
    if (result.success) {
      console.log(`✅ [Ollama] Response generated successfully (${result.response?.length || 0} chars)`);
    } else {
      console.log(`❌ [Ollama] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Ollama] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Memory Store endpoints
app.post('/api/memory/save', async (req: Request, res: Response) => {
  try {
    const { data, filePath } = req.body;
    
    if (!data) {
      res.status(400).json({
        success: false,
        error: 'data is required'
      });
      return;
    }
    
    const result = await saveMemory(data, filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/memory/load', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.filePath as string | undefined;
    const result = await loadMemory(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Command History endpoints
app.post('/api/command-history/save', async (req: Request, res: Response) => {
  try {
    const entry: CommandHistoryEntry = req.body;
    
    if (!entry.command || !entry.intent) {
      res.status(400).json({
        success: false,
        error: 'command and intent are required'
      });
      return;
    }
    
    await saveCommandToHistory(entry);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/command-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await getCommandHistory(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Session History endpoints
app.get('/api/session/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    console.log(`📜 [Session History] Loading last ${limit} messages`);
    
    const messages = await loadSessionHistory(limit);
    
    console.log(`✅ [Session History] Loaded ${messages.length} messages`);
    
    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error(`❌ [Session History] Error loading:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// User Preferences endpoints
app.get('/api/preferences', async (req: Request, res: Response) => {
  try {
    console.log(`📋 [Preferences] Loading user preferences`);
    
    const prefs = await loadPreferences();
    
    console.log(`✅ [Preferences] Loaded preferences`);
    
    res.json({
      success: true,
      preferences: prefs
    });
  } catch (error) {
    console.error(`❌ [Preferences] Error loading:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/preferences', async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    
    if (!key || typeof key !== 'string') {
      res.status(400).json({
        success: false,
        error: 'key is required'
      });
      return;
    }
    
    console.log(`💾 [Preferences] Updating preference: ${key} = ${value}`);
    
    const updatedPrefs = await updatePreference(key, value);
    userPreferences = updatedPrefs; // Update in-memory cache
    
    console.log(`✅ [Preferences] Preference updated`);
    
    res.json({
      success: true,
      message: `Preferencia guardada: ${key}`,
      preferences: updatedPrefs
    });
  } catch (error) {
    console.error(`❌ [Preferences] Error updating:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/session/history', async (req: Request, res: Response) => {
  try {
    const { role, content, timestamp } = req.body;
    
    if (!role || !content || !timestamp) {
      res.status(400).json({
        success: false,
        error: 'role, content, and timestamp are required'
      });
      return;
    }
    
    if (role !== 'user' && role !== 'assistant') {
      res.status(400).json({
        success: false,
        error: 'role must be "user" or "assistant"'
      });
      return;
    }
    
    await saveSessionMessage({ role, content, timestamp });
    
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ [Session History] Error saving:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.delete('/api/session/history', async (req: Request, res: Response) => {
  try {
    console.log(`🗑️ [Session History] Clearing history`);
    
    await clearSessionHistory();
    
    console.log(`✅ [Session History] History cleared`);
    
    res.json({
      success: true,
      message: 'Historial borrado. ¡Empezamos de nuevo!'
    });
  } catch (error) {
    console.error(`❌ [Session History] Error clearing:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Window Management endpoints
app.post('/api/apps/close', async (req: Request, res: Response) => {
  try {
    const { appName } = req.body;
    
    if (!appName) {
      res.status(400).json({
        success: false,
        error: 'appName is required'
      });
      return;
    }
    
    console.log(`🔴 [Close App] Closing app: ${appName}`);
    
    const result = await closeAppByName(appName);
    
    if (result.success) {
      console.log(`✅ [Close App] ${appName} closed successfully`);
    } else {
      console.log(`❌ [Close App] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Close App] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/apps/running', async (req: Request, res: Response) => {
  try {
    console.log(`📋 [Running Apps] Listing running applications`);
    
    const result = await listRunningApps();
    
    if (result.success) {
      console.log(`✅ [Running Apps] Found ${result.count} running apps`);
    } else {
      console.log(`❌ [Running Apps] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Running Apps] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/apps/focus', async (req: Request, res: Response) => {
  try {
    const { appName } = req.body;
    
    if (!appName) {
      res.status(400).json({
        success: false,
        error: 'appName is required'
      });
      return;
    }
    
    console.log(`🎯 [Focus App] Focusing app: ${appName}`);
    
    const result = await focusAppByName(appName);
    
    if (result.success) {
      console.log(`✅ [Focus App] ${appName} focused successfully`);
    } else {
      console.log(`❌ [Focus App] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Focus App] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/apps/minimize', async (req: Request, res: Response) => {
  try {
    const { appName } = req.body;
    
    if (!appName) {
      res.status(400).json({
        success: false,
        error: 'appName is required'
      });
      return;
    }
    
    console.log(`⬇️ [Minimize App] Minimizing app: ${appName}`);
    
    const result = await minimizeAppByName(appName);
    
    if (result.success) {
      console.log(`✅ [Minimize App] ${appName} minimized successfully`);
    } else {
      console.log(`❌ [Minimize App] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [Minimize App] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// System Control endpoints
app.post('/api/system/lock', async (req: Request, res: Response) => {
  try {
    console.log(`🔒 [System] Locking PC`);
    
    const result = await lockPC();
    
    if (result.success) {
      console.log(`✅ [System] PC locked successfully`);
    } else {
      console.log(`❌ [System] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [System] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/system/shutdown', async (req: Request, res: Response) => {
  try {
    console.log(`⚠️ [System] Shutdown requested`);
    
    const result = requestShutdown();
    
    console.log(`✅ [System] Shutdown confirmation requested`);
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [System] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/system/restart', async (req: Request, res: Response) => {
  try {
    console.log(`⚠️ [System] Restart requested`);
    
    const result = requestRestart();
    
    console.log(`✅ [System] Restart confirmation requested`);
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [System] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/system/sleep', async (req: Request, res: Response) => {
  try {
    console.log(`⚠️ [System] Sleep requested`);
    
    const result = requestSleep();
    
    console.log(`✅ [System] Sleep confirmation requested`);
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [System] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/system/confirm', async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    
    if (!action || !['shutdown', 'restart', 'sleep'].includes(action)) {
      res.status(400).json({
        success: false,
        error: 'Valid action (shutdown, restart, or sleep) is required'
      });
      return;
    }
    
    console.log(`✅ [System] Confirming action: ${action}`);
    
    const result = await confirmSystemAction(action);
    
    if (result.success) {
      console.log(`✅ [System] ${action} confirmed and executed`);
    } else {
      console.log(`❌ [System] Error: ${result.error}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error(`❌ [System] Exception:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ── Inicialización (una sola vez al arrancar el servidor) ─────────────────────

const registry = new SkillRegistry()
  .register(new ExcelSkill())
  .register(new AppSkill())
  .register(new FileSkill())
  .register(new SystemSkill())
  .register(new TextEditSkill());
const guard = new RiskGuard();

// Initialize ContextBuilder
const contextBuilder = new ContextBuilder({
  maxHistoryEntries: 10,
  maxContextSize: 8000,
  includeSystemInfo: true,
});

// Initialize SecurityGuard with Allowlist
let securityGuard: SecurityGuard;
(async () => {
  const allowlist = await Allowlist.loadFromFile('./config/allowlist.json');
  securityGuard = new SecurityGuard(guard, { 
    allowlist,
    enableLogging: true,
  });
  console.log('[SecurityGuard] Initialized with allowlist');
})();

// Load user preferences at startup
let userPreferences: UserPreferences = {};
(async () => {
  userPreferences = await loadPreferences();
  console.log(`[Preferences] Loaded user preferences: userName=${userPreferences.userName}`);
})();

// Pending file context for conversational editing (30 minutes TTL)
let pendingFileContext: { filePath: string; fileType: string; timestamp: number } | null = null;

// ── Endpoint unificado ────────────────────────────────────────────────────────

app.post('/api/command', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let { text, confirmed } = req.body;

  // ── Validar input ───────────────────────────────────────────────────────────
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Se requiere el campo "text" con el comando en lenguaje natural',
    });
  }

  console.log(`💬 [Command] Input: "${text}"`);

  // ── Split compound commands ─────────────────────────────────────────────────
  // Handle commands like "recordá X, buscá Y" by processing only the first part
  const commandParts = text.split(/,\s*(?=(?:buscá?|abri[rl]?|cerrá?|creá?|moví?|guardá?|recordá?|leé?|eliminá?|reemplazá?))/i);
  let hasMoreCommands = false;
  
  if (commandParts.length > 1) {
    console.log(`📋 [Command] Compound command detected: ${commandParts.length} parts`);
    text = commandParts[0].trim();
    hasMoreCommands = true;
  }

  // ── Parsear intención ───────────────────────────────────────────────────────
  let parsed = parseCommand(text);
  let context = buildContext(text, confirmed ?? false);
  
  // Debug logging
  console.log('[Command] text:', text, '| intent:', context.intent);
  console.log('[Command] isEditCommand:', /(?:agregá?|agregar?|añadí?|add|insertá?|ponele|poné|llenalo|completalo)/i.test(text));
  console.log('[Command] hasExcelContext:', !!pendingFileContext, pendingFileContext?.filePath);
  
  console.log(`🧠 [Command] Intent: ${context.intent} (params: ${JSON.stringify(context.params)}) [method: ${parsed.method}]`);

  // ── Re-inject file context if intent is unknown ────────────────────────────
  // If we have a pending file context and the intent is unknown, try to enrich the command
  if (pendingFileContext && Date.now() - pendingFileContext.timestamp < 1800000 && context.intent === 'unknown') {
    console.log(`📝 [Command] Re-injecting file context: ${pendingFileContext.filePath}`);
    const enrichedText = `${text} (archivo: ${pendingFileContext.filePath})`;
    const enrichedContext = buildContext(enrichedText, confirmed ?? false);
    
    if (enrichedContext.intent !== 'unknown') {
      console.log(`✅ [Command] File context resolved intent: ${enrichedContext.intent}`);
      context = enrichedContext;
      parsed = parseCommand(enrichedText);
    }
  }

  // Log excel_append_row params for debugging
  if (context.intent === 'excel_append_row') {
    console.log('[Excel] append_row params:', JSON.stringify(context.params));
  }

  // ── Protección contra duplicados ───────────────────────────────────────────
  // Build request key from intent + main param
  const mainParam = context.params.appName || context.params.filePath || context.params.path || '';
  const requestKey = `${context.intent}:${mainParam}`;
  
  if (inFlightRequests.get(requestKey)) {
    console.log(`⚠️  [Command] Duplicate request blocked: ${requestKey}`);
    return res.json({
      success: true,
      message: 'Command is already being processed',
      meta: {
        intent: context.intent,
        skill: 'none',
        confidence: parsed.confidence,
        executionTime: Date.now() - startTime,
        method: parsed.method,
      },
    });
  }
  
  // Mark request as in-flight
  inFlightRequests.set(requestKey, true);
  
  // Clear the in-flight flag after execution
  const clearInFlight = () => {
    setTimeout(() => {
      inFlightRequests.delete(requestKey);
    }, 1500);
  };

  // ── Excel Debug Logging ─────────────────────────────────────────────────────
  console.log('=== EXCEL DEBUG ===');
  console.log('text:', text);
  console.log('isEditCommand:', /(?:agregá?|agregar?|añadí?|add|insertá?|ponele|poné|llenalo|completalo)/i.test(text));
  console.log('hasExcelContext check 1 (pendingFileContext):', !!pendingFileContext?.filePath, pendingFileContext?.filePath);
  console.log('hasExcelContext check 2 (xlsx in text):', /\.xlsx?/i.test(text));
  console.log('hasExcelContext check 3 (ventas/excel/planilla):', /\bventas\b|\bexcel\b|\bplanilla\b/i.test(text));
  console.log('context.intent:', context.intent);
  console.log('=== END DEBUG ===');

  // ── Direct Excel edit detection ────────────────────────────────────────────
  // Handle direct Excel editing commands before falling back to free-form
  const editWords = ['agreg', 'añad', 'insert', 'ponele', 'ponerle', 'llena', 'completa', 'escrib', 'agrega', 'add', 'append'];
  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isEditCommand = editWords.some(w => normalizedText.includes(w));
  const hasExcelContext = !!pendingFileContext?.filePath ||
    /\.xlsx?/i.test(text) ||
    /\bventas\b|\bexcel\b|\bplanilla\b/i.test(text);
  
  if (isEditCommand && hasExcelContext && context.intent === 'unknown') {
    let filePath = pendingFileContext?.filePath ?? 
      text.match(/([\w\/\\]+\.xlsx?)/i)?.[1] ?? 
      text.match(/(?:archivo|file)\s+(\w+)/i)?.[1] ?? '';
    
    // Normalize path (replace backslashes with forward slashes)
    filePath = filePath.replace(/\\/g, '/');
    
    // If filePath is just a name without path, search for it
    if (filePath && !filePath.includes('/') && !filePath.endsWith('.xlsx')) {
      console.log(`📊 [Excel Direct] Searching for file: ${filePath}`);
      try {
        const { execSync } = await import('child_process');
        const found = execSync(
          `find /home -name "*${filePath}*.xlsx" -maxdepth 5 2>/dev/null | head -1`,
          { encoding: 'utf-8' }
        ).trim();
        if (found) {
          filePath = found;
          console.log(`📊 [Excel Direct] Found file: ${filePath}`);
        }
      } catch (error) {
        console.log(`📊 [Excel Direct] File search failed:`, error);
      }
    }
    
    if (filePath) {
      console.log(`📊 [Excel Direct] Detected Excel edit command for: ${filePath}`);
      
      try {
        const { askClaude } = await import('../src/ai/claude_ai.js');
        
        const dataResult = await askClaude(
          `Generate CSV rows for Excel based on this request: "${text}"

Return ONLY raw CSV data, no explanations, no headers if not requested.
One row per line. Max 10 rows. Example:
Toyota Corolla,25000,12 cuotas
Ford Focus,18000,18 cuotas`,
          []
        );
        
        if (dataResult.success && dataResult.response) {
          const rows = dataResult.response
            .split('\n')
            .map((r: string) => r.trim())
            .filter((r: string) => r && !r.startsWith('//') && !r.startsWith('#'))
            .join('\n');
          
          const skill = registry.resolve('excel_append_row');
          
          if (skill && rows) {
            console.log(`📊 [Excel Direct] Generated ${rows.split('\n').length} rows`);
            
            const skillResult = await skill.execute({
              rawCommand: text,
              intent: 'excel_append_row',
              params: { filePath, rows },
              confirmed: false
            });
            
            // Save to session history
            await saveSessionMessage({ 
              role: 'user', 
              content: text, 
              timestamp: new Date().toISOString() 
            });
            await saveSessionMessage({ 
              role: 'assistant', 
              content: skillResult.message ?? '', 
              timestamp: new Date().toISOString() 
            });
            
            clearInFlight();
            
            console.log(`✅ [Excel Direct] Completed — ${Date.now() - startTime}ms`);
            
            return res.json({
              ...skillResult,
              meta: {
                intent: 'excel_append_row',
                skill: 'ExcelSkill',
                confidence: 0.99,
                executionTime: Date.now() - startTime,
                method: 'direct'
              }
            });
          }
        }
      } catch (error) {
        console.error('[Excel Direct] Error:', error);
        // Fall through to normal processing
      }
    }
  }

  // ── Direct Word edit detection ─────────────────────────────────────────────
  const isWordContext = pendingFileContext?.fileType === 'word' ||
    /\.docx?/i.test(text) ||
    /\bword\b|\bdocumento\b/i.test(text);
  
  if (isEditCommand && isWordContext && context.intent === 'unknown') {
    let wordPath = pendingFileContext?.filePath ?? 
      text.match(/([\w\/\\]+\.docx?)/i)?.[1] ?? '';
    
    // Normalize path (replace backslashes with forward slashes)
    wordPath = wordPath.replace(/\\/g, '/');
    
    if (wordPath) {
      console.log(`📝 [Word Direct] Detected Word edit command for: ${wordPath}`);
      
      try {
        const { askClaude } = await import('../src/ai/claude_ai.js');
        
        const dataResult = await askClaude(
          `Generate plain text content to add to a Word document.
User request: "${text}"

Return ONLY the content to add, no explanations.
Use line breaks between items if it's a list.`,
          []
        );
        
        if (dataResult.success && dataResult.response) {
          const skill = registry.resolve('word_append');
          
          if (skill) {
            console.log(`📝 [Word Direct] Generated content`);
            
            const skillResult = await skill.execute({
              rawCommand: text,
              intent: 'word_append',
              params: { filePath: wordPath, content: dataResult.response },
              confirmed: false
            });
            
            // Save to session history
            await saveSessionMessage({ 
              role: 'user', 
              content: text, 
              timestamp: new Date().toISOString() 
            });
            await saveSessionMessage({ 
              role: 'assistant', 
              content: skillResult.message ?? '', 
              timestamp: new Date().toISOString() 
            });
            
            clearInFlight();
            
            console.log(`✅ [Word Direct] Completed — ${Date.now() - startTime}ms`);
            
            return res.json({
              ...skillResult,
              meta: {
                intent: 'word_append',
                skill: 'TextEditSkill',
                confidence: 0.99,
                executionTime: Date.now() - startTime,
                method: 'direct'
              }
            });
          }
        }
      } catch (error) {
        console.error('[Word Direct] Error:', error);
        // Fall through to normal processing
      }
    }
  }

  // ── Direct TXT edit detection ──────────────────────────────────────────────
  const isTxtContext = pendingFileContext?.fileType === 'txt' ||
    /\.txt/i.test(text) ||
    /\btxt\b|\btexto\b|\barchivo\s+de\s+texto\b/i.test(text);
  
  if (isEditCommand && isTxtContext && context.intent === 'unknown') {
    let txtPath = pendingFileContext?.filePath ?? 
      text.match(/([\w\/\\]+\.txt)/i)?.[1] ?? '';
    
    // Normalize path (replace backslashes with forward slashes)
    txtPath = txtPath.replace(/\\/g, '/');
    
    if (txtPath) {
      console.log(`📄 [TXT Direct] Detected TXT edit command for: ${txtPath}`);
      
      try {
        const { askClaude } = await import('../src/ai/claude_ai.js');
        
        const dataResult = await askClaude(
          `Generate text content to append to a text file.
User request: "${text}"

Return ONLY the content to add, no explanations.`,
          []
        );
        
        if (dataResult.success && dataResult.response) {
          const skill = registry.resolve('text_append');
          
          if (skill) {
            console.log(`📄 [TXT Direct] Generated content`);
            
            const skillResult = await skill.execute({
              rawCommand: text,
              intent: 'text_append',
              params: { filePath: txtPath, content: dataResult.response },
              confirmed: false
            });
            
            // Save to session history
            await saveSessionMessage({ 
              role: 'user', 
              content: text, 
              timestamp: new Date().toISOString() 
            });
            await saveSessionMessage({ 
              role: 'assistant', 
              content: skillResult.message ?? '', 
              timestamp: new Date().toISOString() 
            });
            
            clearInFlight();
            
            console.log(`✅ [TXT Direct] Completed — ${Date.now() - startTime}ms`);
            
            return res.json({
              ...skillResult,
              meta: {
                intent: 'text_append',
                skill: 'TextEditSkill',
                confidence: 0.99,
                executionTime: Date.now() - startTime,
                method: 'direct'
              }
            });
          }
        }
      } catch (error) {
        console.error('[TXT Direct] Error:', error);
        // Fall through to normal processing
      }
    }
  }

  if (context.intent === 'unknown') {
    clearInFlight();
    
    // Try free-form chat with Ollama
    console.log(`🤖 [Command] Unknown intent, trying free-form with Ollama`);
    
    try {
      // Load recent session history for context
      const sessionHistory = await loadSessionHistory(10);
      
      // Convert to conversation message format
      const conversationHistory = sessionHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      
      console.log(`📜 [Command] Loaded ${conversationHistory.length} messages from session history`);
      
      // Include pending file context if available (30 minutes TTL)
      const fileContext = pendingFileContext && Date.now() - pendingFileContext.timestamp < 1800000 ? 
        {
          filePath: pendingFileContext.filePath,
          fileType: pendingFileContext.fileType
        } : 
        undefined;
      
      // Include user preferences context
      const prefsContext = userPreferences.userName ? 
        `Nombre del usuario: ${userPreferences.userName}` : 
        undefined;
      
      const freeFormResult = await handleFreeForm(text, registry, contextBuilder, conversationHistory, fileContext, prefsContext);
      
      // Log to history
      await saveCommandToHistory({
        timestamp: new Date().toISOString(),
        command: text,
        intent: 'free_form',
        method: 'ollama',
        confidence: 0.7,
        executionTime: Date.now() - startTime,
        result: freeFormResult.success ? 'success' : `error: ${freeFormResult.error ?? freeFormResult.message}`,
      });
      
      console.log(
        `${freeFormResult.success ? '✅' : '❌'} [Command] free_form.ollama ` +
        `— ${Date.now() - startTime}ms [llm]`
      );
      
      return res.json({
        ...freeFormResult,
        meta: {
          intent: 'free_form',
          skill: 'ollama',
          confidence: 0.7,
          executionTime: Date.now() - startTime,
          method: 'llm',
        },
      });
    } catch (error) {
      console.error('[Command] Free-form error:', error);
      // Fallback to original error message
      return res.json({
        success: false,
        message: 'No entendí el comando. Probá con algo como "abrí Chrome" o "resumen por mes de ventas.xlsx".',
        data: { intent: 'unknown', rawInput: text },
        meta: {
          intent: 'unknown',
          skill: 'none',
          confidence: 0,
          executionTime: Date.now() - startTime,
          method: parsed.method,
        },
      });
    }
  }

  // ── Handle clear_history command directly ──────────────────────────────────
  if (context.intent === 'clear_history') {
    clearInFlight();
    
    try {
      await clearSessionHistory();
      
      console.log(`✅ [Command] Session history cleared — ${Date.now() - startTime}ms`);
      
      return res.json({
        success: true,
        message: 'Historial borrado. ¡Empezamos de nuevo!',
        meta: {
          intent: 'clear_history',
          skill: 'system',
          confidence: 1.0,
          executionTime: Date.now() - startTime,
          method: parsed.method,
        },
      });
    } catch (error) {
      console.error('[Command] Clear history error:', error);
      return res.json({
        success: false,
        message: 'Error al borrar el historial',
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          intent: 'clear_history',
          skill: 'system',
          confidence: 1.0,
          executionTime: Date.now() - startTime,
          method: parsed.method,
        },
      });
    }
  }

  // ── Handle help command directly ───────────────────────────────────────────
  if (context.intent === 'show_help') {
    clearInFlight();
    
    const skills = registry.getAll().map(s => ({
      name: s.name,
      description: s.description,
      intents: s.supportedIntents,
      riskLevel: s.riskLevel,
    }));
    
    const intents = registry.getIntentMap();
    
    console.log(`✅ [Command] Help requested — ${Date.now() - startTime}ms`);
    
    return res.json({
      success: true,
      message: 'Comandos disponibles',
      data: {
        skills,
        intents,
      },
      meta: {
        intent: 'show_help',
        skill: 'system',
        confidence: 1.0,
        executionTime: Date.now() - startTime,
        method: parsed.method,
      },
    });
  }

  // ── Resolver skill ──────────────────────────────────────────────────────────
  const skill = registry.resolve(context.intent);

  if (!skill) {
    clearInFlight();
    return res.json({
      success: false,
      message: `No hay una skill disponible para: ${context.intent}`,
      data: { intent: context.intent },
      meta: {
        intent: context.intent,
        skill: 'none',
        confidence: parsed.confidence,
        executionTime: Date.now() - startTime,
        method: parsed.method,
      },
    });
  }

  console.log(`⚡ [Command] Dispatching to skill: ${skill.name}`);

  // ── Validar parámetros ──────────────────────────────────────────────────────
  const validationError = skill.validate(context);
  if (validationError) {
    clearInFlight();
    return res.json({
      success: false,
      message: validationError,
      data: { intent: context.intent, skill: skill.name },
      meta: {
        intent: context.intent,
        skill: skill.name,
        confidence: parsed.confidence,
        executionTime: Date.now() - startTime,
        method: parsed.method,
      },
    });
  }

  // ── Ejecutar con SecurityGuard ──────────────────────────────────────────────
  console.log(`[Server] Executing: ${context.intent}`, JSON.stringify(context.params));
  const result = await securityGuard.execute(skill, context);

  // ── Set pending file context for conversational editing ────────────────────
  if (result.success && ['excel_edit', 'word_edit', 'txt_edit'].includes(context.intent)) {
    const filePath = String(context.params.filePath ?? '');
    const fileType = context.intent.replace('_edit', '');
    pendingFileContext = { filePath, fileType, timestamp: Date.now() };
    console.log(`📝 [Command] Set pending file context: ${filePath} (${fileType})`);
  }

  // Clear pending file context only on explicit topic changes
  const shouldClearContext = ['clear_history', 'system_shutdown', 'system_restart', 'system_sleep', 'system_lock'].includes(context.intent);
  if (shouldClearContext) {
    pendingFileContext = null;
    console.log(`🗑️ [Command] Cleared pending file context`);
  }

  // ── Narrar resultado con Ollama (solo si fue exitoso) ──────────────────────
  if (result.success && NARRATION_ENABLED) {
    try {
      const narratedMessage = await narrateResult(result, text);
      result.message = narratedMessage;
    } catch (error) {
      // Graceful fallback - keep original message
      console.log(`[Narrator] Skipped (error: ${error instanceof Error ? error.message : 'unknown'})`);
    }
  }

  // ── Loguear en historial ────────────────────────────────────────────────────
  await saveCommandToHistory({
    timestamp: new Date().toISOString(),
    command: text,
    intent: context.intent,
    method: skill.name,
    confidence: parsed.confidence,
    executionTime: Date.now() - startTime,
    result: result.success ? 'success' : `error: ${result.error ?? result.message}`,
  });

  console.log(
    `${result.success ? '✅' : '❌'} [Command] ${skill.name}.${context.intent} ` +
    `— ${Date.now() - startTime}ms [${parsed.method}]`
  );

  // Clear in-flight flag before returning
  clearInFlight();

  // Add note about remaining commands if this was a compound command
  let finalMessage = result.message;
  if (hasMoreCommands && result.success) {
    const remainingCommands = commandParts.slice(1).join(', ');
    finalMessage = `${result.message}\n\n💡 También querías: "${remainingCommands}". ¿Lo hago?`;
  }

  return res.json({
    ...result,
    message: finalMessage,
    meta: {
      intent: context.intent,
      skill: skill.name,
      confidence: parsed.confidence,
      executionTime: Date.now() - startTime,
      method: parsed.method,
    },
  });
});

// Listar skills disponibles (útil para el panel de ayuda en la UI)
app.get('/api/skills', (req: Request, res: Response) => {
  res.json({
    success: true,
    skills: registry.getAll().map(s => ({
      name: s.name,
      description: s.description,
      intents: s.supportedIntents,
      riskLevel: s.riskLevel,
    })),
    intents: registry.getIntentMap(),
  });
});

// Ver acciones pendientes de confirmación (removed - not implemented in RiskGuard)
// app.get('/api/command/pending', (req: Request, res: Response) => {
//   res.json({
//     success: true,
//     pending: guard.listPending(),
//   });
// });



// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/open/calculator`);
  console.log(`   POST http://localhost:${PORT}/api/open/notepad`);
  console.log(`   POST http://localhost:${PORT}/api/open/chrome`);
  console.log(`   POST http://localhost:${PORT}/api/open/vscode`);
  console.log(`   POST http://localhost:${PORT}/api/open/steam`);
  console.log(`   POST http://localhost:${PORT}/api/open/discord`);
  console.log(`   POST http://localhost:${PORT}/api/open-app`);
  console.log(`   GET  http://localhost:${PORT}/api/available-apps`);
  console.log(`   GET  http://localhost:${PORT}/api/list-apps`);
  console.log(`   POST http://localhost:${PORT}/api/read-file`);
  console.log(`   POST http://localhost:${PORT}/api/read-file-path`);
  console.log(`   POST http://localhost:${PORT}/api/search-files`);
  console.log(`   POST http://localhost:${PORT}/api/open-file`);
  console.log(`   POST http://localhost:${PORT}/api/open-folder`);
  console.log(`   POST http://localhost:${PORT}/api/analyze-csv`);
  console.log(`   POST http://localhost:${PORT}/api/excel/create`);
  console.log(`   POST http://localhost:${PORT}/api/excel/read`);
  console.log(`   POST http://localhost:${PORT}/api/excel/write`);
  console.log(`   POST http://localhost:${PORT}/api/word/create`);
  console.log(`   POST http://localhost:${PORT}/api/word/append`);
  console.log(`   POST http://localhost:${PORT}/api/apps/close`);
  console.log(`   GET  http://localhost:${PORT}/api/apps/running`);
  console.log(`   POST http://localhost:${PORT}/api/apps/focus`);
  console.log(`   POST http://localhost:${PORT}/api/apps/minimize`);
  console.log(`   POST http://localhost:${PORT}/api/system/lock`);
  console.log(`   POST http://localhost:${PORT}/api/system/shutdown`);
  console.log(`   POST http://localhost:${PORT}/api/system/restart`);
  console.log(`   POST http://localhost:${PORT}/api/system/sleep`);
  console.log(`   POST http://localhost:${PORT}/api/system/confirm`);
  console.log(`   POST http://localhost:${PORT}/api/ollama`);
  console.log(`   POST http://localhost:${PORT}/api/memory/save`);
  console.log(`   GET  http://localhost:${PORT}/api/memory/load`);
  console.log(`   POST http://localhost:${PORT}/api/command-history/save`);
  console.log(`   GET  http://localhost:${PORT}/api/command-history`);
  console.log(`   GET  http://localhost:${PORT}/api/session/history`);
  console.log(`   POST http://localhost:${PORT}/api/session/history`);
  console.log(`   DELETE http://localhost:${PORT}/api/session/history`);
});
