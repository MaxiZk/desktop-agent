/**
 * ContextBuilder.ts — Context enrichment system for AI requests
 * 
 * Builds enriched context before sending requests to AI services,
 * including command history, memory entries, system info, and current intent.
 */

import { getCommandHistory, type CommandHistoryEntry } from '../../backend/index.js';
import { loadMemory } from '../../memory/local_memory.js';
import { platform, arch, version } from 'os';

export interface SystemInfo {
  os: string;
  platform: string;
  arch: string;
  nodeVersion: string;
}

export interface MemoryEntry {
  key: string;
  value: any;
  timestamp?: string;
}

export interface ContextData {
  timestamp: string;
  systemInfo: SystemInfo;
  commandHistory: CommandHistoryEntry[];
  memoryEntries: MemoryEntry[];
  currentIntent: string;
  activeSkill: string | null;
}

export interface ContextBuilderOptions {
  maxHistoryEntries?: number;  // default: 10
  maxContextSize?: number;      // default: 8000 chars
  includeSystemInfo?: boolean;  // default: true
}

export class ContextBuilder {
  private options: Required<ContextBuilderOptions>;
  private cachedSystemInfo: SystemInfo | null = null;

  constructor(options?: ContextBuilderOptions) {
    this.options = {
      maxHistoryEntries: options?.maxHistoryEntries ?? 10,
      maxContextSize: options?.maxContextSize ?? 8000,
      includeSystemInfo: options?.includeSystemInfo ?? true,
    };
  }

  /**
   * Build complete enriched context
   */
  async buildContext(intent: string, skill?: string): Promise<ContextData> {
    const context: ContextData = {
      timestamp: new Date().toISOString(),
      systemInfo: this.getSystemInfo(),
      commandHistory: await this.getCommandHistory(this.options.maxHistoryEntries),
      memoryEntries: await this.getRelevantMemory([]),
      currentIntent: intent,
      activeSkill: skill ?? null,
    };

    // Validate and truncate if needed
    this.validateSize(context);

    return context;
  }

  /**
   * Retrieve last N commands from command history
   */
  async getCommandHistory(limit: number): Promise<CommandHistoryEntry[]> {
    try {
      const result = await getCommandHistory(limit);
      if (result.success && Array.isArray(result)) {
        return result;
      }
      return [];
    } catch (error) {
      console.warn('[ContextBuilder] Failed to load command history:', error);
      return [];
    }
  }

  /**
   * Retrieve relevant memory entries based on keyword matching
   */
  async getRelevantMemory(keywords: string[]): Promise<MemoryEntry[]> {
    try {
      const result = await loadMemory();
      if (!result.success || !result.data) {
        return [];
      }

      const entries: MemoryEntry[] = [];
      const normalizedKeywords = keywords.map(k => k.toLowerCase());

      for (const [key, value] of Object.entries(result.data)) {
        // If no keywords, include all entries
        if (keywords.length === 0) {
          entries.push({ key, value });
          continue;
        }

        // Check if key matches any keyword (case-insensitive)
        const normalizedKey = key.toLowerCase();
        if (normalizedKeywords.some(kw => normalizedKey.includes(kw))) {
          entries.push({ key, value });
        }
      }

      return entries;
    } catch (error) {
      console.warn('[ContextBuilder] Failed to load memory:', error);
      return [];
    }
  }

  /**
   * Get system information (cached for performance)
   */
  getSystemInfo(): SystemInfo {
    if (this.cachedSystemInfo) {
      return this.cachedSystemInfo;
    }

    this.cachedSystemInfo = {
      os: platform(),
      platform: process.platform,
      arch: arch(),
      nodeVersion: version(),
    };

    return this.cachedSystemInfo;
  }

  /**
   * Serialize context for AI consumption
   */
  serializeForAI(context: ContextData): string {
    return JSON.stringify(context, null, 2);
  }

  /**
   * Pretty print context for debugging
   */
  prettyPrint(context: ContextData): string {
    const lines: string[] = [];
    
    lines.push('=== Context Data ===');
    lines.push(`Timestamp: ${context.timestamp}`);
    lines.push(`Intent: ${context.currentIntent}`);
    lines.push(`Active Skill: ${context.activeSkill ?? 'none'}`);
    lines.push('');
    
    lines.push('System Info:');
    lines.push(`  OS: ${context.systemInfo.os}`);
    lines.push(`  Platform: ${context.systemInfo.platform}`);
    lines.push(`  Arch: ${context.systemInfo.arch}`);
    lines.push(`  Node: ${context.systemInfo.nodeVersion}`);
    lines.push('');
    
    lines.push(`Command History (${context.commandHistory.length} entries):`);
    context.commandHistory.forEach((cmd, i) => {
      lines.push(`  ${i + 1}. [${cmd.timestamp}] ${cmd.command} → ${cmd.result}`);
    });
    lines.push('');
    
    lines.push(`Memory Entries (${context.memoryEntries.length} entries):`);
    context.memoryEntries.forEach(entry => {
      lines.push(`  ${entry.key}: ${JSON.stringify(entry.value)}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Validate context size and truncate if needed
   */
  private validateSize(context: ContextData): void {
    let serialized = this.serializeForAI(context);
    
    // If within limit, we're done
    if (serialized.length <= this.options.maxContextSize) {
      return;
    }

    // Truncate command history from oldest to newest until we fit
    while (context.commandHistory.length > 0 && serialized.length > this.options.maxContextSize) {
      context.commandHistory.shift(); // Remove oldest entry
      serialized = this.serializeForAI(context);
    }

    // If still too large, truncate memory entries
    while (context.memoryEntries.length > 0 && serialized.length > this.options.maxContextSize) {
      context.memoryEntries.shift();
      serialized = this.serializeForAI(context);
    }

    console.warn(`[ContextBuilder] Context truncated to ${serialized.length} chars (limit: ${this.options.maxContextSize})`);
  }
}
