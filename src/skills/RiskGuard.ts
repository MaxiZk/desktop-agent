/**
 * RiskGuard.ts — Capa de seguridad por nivel de riesgo
 *
 * Intercepta la ejecución de skills de riesgo medio o alto
 * y exige confirmación explícita del usuario antes de proceder.
 *
 * Generaliza el patrón ya implementado en system_controls.ts
 * para que aplique a todas las skills del sistema.
 */

import type { Skill, SkillContext, SkillResult, RiskLevel } from './Skill.js';

// Confirmaciones pendientes: token → { action, timestamp }
const pendingConfirmations = new Map<string, { action: string; timestamp: number }>();
const TIMEOUT_MS = 30_000; // 30 segundos

function cleanExpired(): void {
  const now = Date.now();
  for (const [token, data] of pendingConfirmations.entries()) {
    if (now - data.timestamp > TIMEOUT_MS) {
      pendingConfirmations.delete(token);
    }
  }
}

function generateToken(action: string): string {
  cleanExpired();
  const token = `${action}_${Date.now()}`;
  pendingConfirmations.set(token, { action, timestamp: Date.now() });
  return token;
}

function verifyToken(intent: string): boolean {
  cleanExpired();
  for (const [token, data] of pendingConfirmations.entries()) {
    if (data.action === intent) {
      pendingConfirmations.delete(token);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mensajes de advertencia por nivel de riesgo
// ---------------------------------------------------------------------------

const RISK_MESSAGES: Record<RiskLevel, string | null> = {
  low: null, // Sin advertencia
  medium: 'Esta acción modificará archivos. ¿Confirmás?',
  high: '⚠️ Esta acción es destructiva o irreversible. ¿Confirmás?',
};

// ---------------------------------------------------------------------------
// Guardia principal
// ---------------------------------------------------------------------------

export class RiskGuard {
  /**
   * Ejecuta una skill respetando su nivel de riesgo.
   *
   * - Riesgo bajo: ejecuta directo.
   * - Riesgo medio/alto: si no hay confirmación, devuelve requiresConfirmation=true.
   *   En el próximo llamado con confirmed=true y el token correcto, ejecuta.
   */
  async execute(skill: Skill, context: SkillContext): Promise<SkillResult> {
    const risk = skill.riskLevel;

    // Riesgo bajo: ejecutar sin preguntar
    if (risk === 'low') {
      return skill.execute(context);
    }

    // Riesgo medio/alto: verificar si ya fue confirmado
    if (context.confirmed && verifyToken(context.intent)) {
      console.log(`[RiskGuard] Confirmed execution: ${skill.name} / ${context.intent}`);
      return skill.execute(context);
    }

    // Sin confirmación: generar token y pedir confirmación
    const token = generateToken(context.intent);
    const warningMessage = RISK_MESSAGES[risk] ?? '¿Confirmás esta acción?';

    console.warn(`[RiskGuard] Action requires confirmation: ${skill.name} / ${context.intent} (risk: ${risk})`);

    return {
      success: true,
      message: warningMessage,
      requiresConfirmation: true,
      confirmationToken: token,
    };
  }
}

export const riskGuard = new RiskGuard();
