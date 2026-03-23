/**
 * SecurityGuard.ts — Enhanced security layer for command validation
 * 
 * Extends RiskGuard with improved risk detection, allowlist support,
 * and detailed logging for high-risk actions.
 */

import { RiskGuard } from '../../skills/RiskGuard.js';
import { Allowlist } from './Allowlist.js';
import type { Skill, SkillContext, SkillResult } from '../../skills/Skill.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskAssessment {
  level: RiskLevel;
  reason: string;
  requiresConfirmation: boolean;
  allowlistBypass: boolean;
}

export interface SecurityGuardOptions {
  allowlist?: Allowlist;
  enableLogging?: boolean;
}

// Risk classification rules
const RISK_RULES = {
  HIGH: [
    'system_shutdown',
    'system_restart',
    'system_sleep',
    'file_delete',
    'excel_delete_row',
    'text_delete',
  ],
  MEDIUM: [
    'open_app',
    'file_create',
    'excel_write',
    'excel_create',
    'text_replace',
    'word_create',
    'word_append',
  ],
  LOW: [
    'open_file',
    'read_file',
    'search_files',
    'excel_read',
    'show_help',
    'open_url',
    'system_lock',
  ],
};

export class SecurityGuard {
  private allowlist: Allowlist | null;
  private enableLogging: boolean;

  constructor(
    private riskGuard: RiskGuard,
    options?: SecurityGuardOptions
  ) {
    this.allowlist = options?.allowlist ?? null;
    this.enableLogging = options?.enableLogging ?? true;
  }

  /**
   * Assess risk level of an action
   */
  assessRisk(
    intent: string,
    params: Record<string, unknown>
  ): RiskAssessment {
    // Determine base risk level
    let level: RiskLevel = 'MEDIUM'; // Default for unknown intents
    let reason = 'Unknown action type';

    if (RISK_RULES.HIGH.includes(intent)) {
      level = 'HIGH';
      reason = this.getHighRiskReason(intent);
    } else if (RISK_RULES.MEDIUM.includes(intent)) {
      level = 'MEDIUM';
      reason = this.getMediumRiskReason(intent);
    } else if (RISK_RULES.LOW.includes(intent)) {
      level = 'LOW';
      reason = 'Read-only or safe operation';
    }

    // Check allowlist for bypass
    let allowlistBypass = false;
    
    if (this.allowlist) {
      // Check app allowlist
      if (params.appName && typeof params.appName === 'string') {
        const result = this.allowlist.checkApp(params.appName);
        if (result.allowed) {
          allowlistBypass = true;
          reason += ` (allowlisted app: ${result.matchedEntry})`;
        }
      }

      // Check path allowlist
      if (params.filePath && typeof params.filePath === 'string') {
        const result = this.allowlist.checkPath(params.filePath);
        if (result.allowed) {
          allowlistBypass = true;
          reason += ` (allowlisted path: ${result.matchedEntry})`;
        }
      }

      if (params.path && typeof params.path === 'string') {
        const result = this.allowlist.checkPath(params.path);
        if (result.allowed) {
          allowlistBypass = true;
          reason += ` (allowlisted path: ${result.matchedEntry})`;
        }
      }
    }

    // Determine if confirmation is required
    const requiresConfirmation = level === 'HIGH' && !allowlistBypass;

    return {
      level,
      reason,
      requiresConfirmation,
      allowlistBypass,
    };
  }

  /**
   * Execute skill with security validation
   */
  async execute(
    skill: Skill,
    context: SkillContext
  ): Promise<SkillResult> {
    // Assess risk
    const assessment = this.assessRisk(context.intent, context.params);

    if (this.enableLogging) {
      console.log(`[SecurityGuard] Risk assessment for ${context.intent}:`, assessment);
    }

    // If allowlist bypass, execute directly without RiskGuard
    if (assessment.allowlistBypass) {
      if (this.enableLogging) {
        console.log(`[SecurityGuard] Allowlist bypass for ${context.intent}`);
      }
      return skill.execute(context);
    }

    // Otherwise, use RiskGuard for confirmation flow
    const result = await this.riskGuard.execute(skill, context);

    // Log HIGH risk confirmations
    if (assessment.level === 'HIGH' && context.confirmed && result.success) {
      this.logConfirmation(context.intent, context.params);
    }

    return result;
  }

  /**
   * Check if an item is allowlisted
   */
  isAllowlisted(type: 'app' | 'path', value: string): boolean {
    if (!this.allowlist) {
      return false;
    }

    if (type === 'app') {
      return this.allowlist.checkApp(value).allowed;
    } else {
      return this.allowlist.checkPath(value).allowed;
    }
  }

  /**
   * Get reason for HIGH risk classification
   */
  private getHighRiskReason(intent: string): string {
    const reasons: Record<string, string> = {
      system_shutdown: 'Shutdown operations are destructive and irreversible',
      system_restart: 'Restart operations are destructive and irreversible',
      system_sleep: 'Sleep operations affect system availability',
      file_delete: 'File deletion is irreversible',
      excel_delete_row: 'Data deletion is irreversible',
      text_delete: 'Text deletion is irreversible',
    };

    return reasons[intent] ?? 'High-risk destructive operation';
  }

  /**
   * Get reason for MEDIUM risk classification
   */
  private getMediumRiskReason(intent: string): string {
    const reasons: Record<string, string> = {
      open_app: 'Opening unknown applications',
      file_create: 'File creation modifies filesystem',
      excel_write: 'Writing to Excel files modifies data',
      excel_create: 'Creating Excel files modifies filesystem',
      text_replace: 'Text replacement modifies file content',
      word_create: 'Creating Word files modifies filesystem',
      word_append: 'Appending to Word files modifies content',
    };

    return reasons[intent] ?? 'Medium-risk modification operation';
  }

  /**
   * Log HIGH risk action confirmation
   */
  private logConfirmation(
    intent: string,
    params: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      intent,
      params,
      level: 'HIGH' as RiskLevel,
    };

    console.warn('[SecurityGuard] HIGH RISK ACTION CONFIRMED:', JSON.stringify(logEntry, null, 2));
  }
}
