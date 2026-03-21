/**
 * Skill.ts — Contrato base del motor de skills
 *
 * Toda skill del sistema debe implementar esta interfaz.
 * Esto permite al SkillRegistry tratar todas las skills de forma uniforme,
 * sin conocer sus detalles internos.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}

export interface SkillContext {
  /** Texto original del usuario */
  rawCommand: string;
  /** Intent detectado por el CommandRouter */
  intent: string;
  /** Parámetros extraídos del comando */
  params: Record<string, unknown>;
  /** Indica si el usuario ya confirmó una acción de riesgo */
  confirmed?: boolean;
}

export interface Skill {
  /** Nombre único de la skill (ej: "AppSkill") */
  readonly name: string;

  /** Descripción legible para logs y UI */
  readonly description: string;

  /** Lista de intents que esta skill puede manejar */
  readonly supportedIntents: string[];

  /** Nivel de riesgo de las acciones de esta skill */
  readonly riskLevel: RiskLevel;

  /**
   * Valida si los parámetros recibidos son suficientes para ejecutar.
   * Devuelve null si es válido, o un mensaje de error si falta algo.
   */
  validate(context: SkillContext): string | null;

  /**
   * Ejecuta la acción principal de la skill.
   * Solo se llama si validate() devolvió null.
   */
  execute(context: SkillContext): Promise<SkillResult>;
}
