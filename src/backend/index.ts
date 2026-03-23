/**
 * Backend Service - Central Orchestration Module
 * 
 * This module serves as the central export point for all backend skills and capabilities.
 * It provides a unified interface for the frontend to access all backend functionality
 * including Windows app launching, file operations, CSV analysis, AI integration,
 * and memory persistence.
 * 
 * This is a pure re-export module with no business logic.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

// Re-export Windows App Launcher functions
export { openCalculator, openNotepad, openChrome, openVSCode, openSteam, openDiscord } from '../skills/open_windows_app';

// Re-export File Reader function
export { readFile } from '../skills/read_file';

// Re-export File Reader by Path function
export { readFileByPath } from '../skills/read_file_by_path';

// Re-export File Search function
export { searchFiles } from '../skills/search_files';

// Re-export Open File function
export { openFile } from '../skills/open_file';

// Re-export Open Folder function
export { openFolder } from '../skills/open_folder';

// Re-export Command History functions
export { saveCommandToHistory, getCommandHistory } from '../skills/command_history';
export type { CommandHistoryEntry } from '../skills/command_history';

// Re-export Open App By Name function
export { openAppByName, getAvailableApps, getAppDetails } from '../skills/open_app_by_name';

// Re-export Excel Operations
export { createExcelFile, readExcelFile, writeExcelFile } from '../skills/excel_operations';

// Re-export Word Operations
export { createWordFile, appendToWordFile } from '../skills/word_operations';

// Re-export CSV Analyzer function
export { analyzeCSV } from '../skills/analyze_csv';

// Re-export Ollama AI Client function
export { generateAIResponse } from '../ai/ollama_ai';

// Re-export Memory Store functions
export { saveMemory, loadMemory } from '../memory/local_memory';

// Re-export Window Management functions
export { closeAppByName, listRunningApps, focusAppByName, minimizeAppByName } from '../skills/window_management';
export type { WindowManagementResult, RunningApp, RunningAppsResult } from '../skills/window_management';

// Re-export System Controls functions
export { lockPC, requestShutdown, shutdownPC, requestRestart, restartPC, requestSleep, sleepPC, confirmSystemAction } from '../skills/system_controls';
export type { SystemControlResult } from '../skills/system_controls';

// Re-export Archive Operations
export { listArchive, extractArchive, createArchive } from '../skills/archive_operations';
export type { ArchiveResult } from '../skills/archive_operations';
