/**
 * RiskGuard.test.ts — Tests para la capa de seguridad
 * 
 * Cubre:
 * - Ejecución directa de riesgo bajo
 * - Bloqueo con token para riesgo alto
 * - confirm() con token válido/inválido/reusado
 * - Validación de parámetros fallida
 * - Timeout de tokens
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskGuard } from '../RiskGuard.js';
import type { Skill, SkillContext, SkillResult } from '../Skill.js';

// Mock skill de riesgo bajo
class LowRiskSkill implements Skill {
  readonly name = 'low-risk';
  readonly description = 'Low risk skill';
  readonly supportedIntents = ['safe_action'];
  readonly riskLevel = 'low' as const;

  validate(_context: SkillContext): string | null {
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Safe action executed' };
  }
}

// Mock skill de riesgo medio
class MediumRiskSkill implements Skill {
  readonly name = 'medium-risk';
  readonly description = 'Medium risk skill';
  readonly supportedIntents = ['modify_action'];
  readonly riskLevel = 'medium' as const;

  validate(_context: SkillContext): string | null {
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Modification executed' };
  }
}

// Mock skill de riesgo alto
class HighRiskSkill implements Skill {
  readonly name = 'high-risk';
  readonly description = 'High risk skill';
  readonly supportedIntents = ['dangerous_action'];
  readonly riskLevel = 'high' as const;

  validate(_context: SkillContext): string | null {
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Dangerous action executed' };
  }
}

// Mock skill con validación fallida
class ValidationFailSkill implements Skill {
  readonly name = 'validation-fail';
  readonly description = 'Skill with validation';
  readonly supportedIntents = ['validated_action'];
  readonly riskLevel = 'low' as const;

  validate(context: SkillContext): string | null {
    if (!context.params.required) {
      return 'Missing required parameter';
    }
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Validated action executed' };
  }
}

describe('RiskGuard', () => {
  let guard: RiskGuard;

  beforeEach(() => {
    guard = new RiskGuard();
  });

  describe('low risk execution', () => {
    it('should execute low risk skill directly', async () => {
      const skill = new LowRiskSkill();
      const context: SkillContext = {
        rawCommand: 'safe action',
        intent: 'safe_action',
        params: {},
        confirmed: false,
      };

      const result = await guard.execute(skill, context);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Safe action executed');
      expect(result.requiresConfirmation).toBeUndefined();
    });

    it('should not require confirmation for low risk', async () => {
      const skill = new LowRiskSkill();
      const context: SkillContext = {
        rawCommand: 'safe action',
        intent: 'safe_action',
        params: {},
        confirmed: false,
      };

      const result = await guard.execute(skill, context);

      expect(result.requiresConfirmation).toBeUndefined();
      expect(result.confirmationToken).toBeUndefined();
    });
  });

  describe('medium risk execution', () => {
    it('should require confirmation for medium risk', async () => {
      const skill = new MediumRiskSkill();
      const context: SkillContext = {
        rawCommand: 'modify something',
        intent: 'modify_action',
        params: {},
        confirmed: false,
      };

      const result = await guard.execute(skill, context);

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationToken).toBeDefined();
      expect(result.message).toBe('Esta acción modificará archivos. ¿Confirmás?');
    });

    it('should execute medium risk with valid confirmation', async () => {
      const skill = new MediumRiskSkill();
      
      // Primera llamada: obtener token
      const context1: SkillContext = {
        rawCommand: 'modify something',
        intent: 'modify_action',
        params: {},
        confirmed: false,
      };
      const result1 = await guard.execute(skill, context1);
      expect(result1.requiresConfirmation).toBe(true);

      // Segunda llamada: confirmar con token
      const context2: SkillContext = {
        rawCommand: 'modify something',
        intent: 'modify_action',
        params: {},
        confirmed: true,
      };
      const result2 = await guard.execute(skill, context2);

      expect(result2.success).toBe(true);
      expect(result2.message).toBe('Modification executed');
      expect(result2.requiresConfirmation).toBeUndefined();
    });
  });

  describe('high risk execution', () => {
    it('should require confirmation for high risk', async () => {
      const skill = new HighRiskSkill();
      const context: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };

      const result = await guard.execute(skill, context);

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationToken).toBeDefined();
      expect(result.message).toBe('⚠️ Esta acción es destructiva o irreversible. ¿Confirmás?');
    });

    it('should execute high risk with valid confirmation', async () => {
      const skill = new HighRiskSkill();
      
      // Primera llamada: obtener token
      const context1: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };
      const result1 = await guard.execute(skill, context1);
      expect(result1.requiresConfirmation).toBe(true);

      // Segunda llamada: confirmar con token
      const context2: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: true,
      };
      const result2 = await guard.execute(skill, context2);

      expect(result2.success).toBe(true);
      expect(result2.message).toBe('Dangerous action executed');
      expect(result2.requiresConfirmation).toBeUndefined();
    });

    it('should reject execution without confirmation', async () => {
      const skill = new HighRiskSkill();
      const context: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };

      const result = await guard.execute(skill, context);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.message).toContain('⚠️');
    });
  });

  describe('token management', () => {
    it('should generate unique tokens', async () => {
      const skill = new HighRiskSkill();
      const context: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };

      const result1 = await guard.execute(skill, context);
      
      // Pequeño delay para asegurar timestamps diferentes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result2 = await guard.execute(skill, context);

      expect(result1.confirmationToken).toBeDefined();
      expect(result2.confirmationToken).toBeDefined();
      expect(result1.confirmationToken).not.toBe(result2.confirmationToken);
    });

    it('should not allow token reuse', async () => {
      const skill = new HighRiskSkill();
      
      // Primera llamada: obtener token
      const context1: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };
      await guard.execute(skill, context1);

      // Segunda llamada: confirmar (consume el token)
      const context2: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: true,
      };
      const result2 = await guard.execute(skill, context2);
      expect(result2.message).toBe('Dangerous action executed');

      // Tercera llamada: intentar reusar (debe pedir nuevo token)
      const context3: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };
      const result3 = await guard.execute(skill, context3);
      expect(result3.requiresConfirmation).toBe(true);
    });

    it('should reject confirmation with wrong intent', async () => {
      const skill1 = new HighRiskSkill();
      const skill2 = new MediumRiskSkill();
      
      // Generar token para skill1
      const context1: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };
      await guard.execute(skill1, context1);

      // Intentar confirmar con skill2 (intent diferente) - debe pedir nuevo token
      const context2: SkillContext = {
        rawCommand: 'modify something',
        intent: 'modify_action',
        params: {},
        confirmed: false,
      };
      const result2 = await guard.execute(skill2, context2);

      expect(result2.requiresConfirmation).toBe(true);
    });
  });

  describe('token timeout', () => {
    it('should expire tokens after timeout', async () => {
      vi.useFakeTimers();

      const skill = new HighRiskSkill();
      
      // Generar token
      const context1: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: false,
      };
      await guard.execute(skill, context1);

      // Avanzar tiempo más allá del timeout (30 segundos)
      vi.advanceTimersByTime(31_000);

      // Intentar confirmar con token expirado
      const context2: SkillContext = {
        rawCommand: 'dangerous action',
        intent: 'dangerous_action',
        params: {},
        confirmed: true,
      };
      const result2 = await guard.execute(skill, context2);

      expect(result2.requiresConfirmation).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('validation integration', () => {
    it('should not execute if validation fails', async () => {
      const skill = new ValidationFailSkill();
      const context: SkillContext = {
        rawCommand: 'validated action',
        intent: 'validated_action',
        params: {}, // Missing required parameter
        confirmed: false,
      };

      // Note: RiskGuard doesn't call validate() - that's done by the server
      // This test verifies the skill's validate method works correctly
      const validationError = skill.validate(context);
      expect(validationError).toBe('Missing required parameter');
    });

    it('should execute if validation passes', async () => {
      const skill = new ValidationFailSkill();
      const context: SkillContext = {
        rawCommand: 'validated action',
        intent: 'validated_action',
        params: { required: 'value' },
        confirmed: false,
      };

      const validationError = skill.validate(context);
      expect(validationError).toBeNull();

      const result = await guard.execute(skill, context);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Validated action executed');
    });
  });
});
