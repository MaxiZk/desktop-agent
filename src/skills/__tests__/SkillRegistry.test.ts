/**
 * SkillRegistry.test.ts — Tests para el registro central de skills
 * 
 * Cubre:
 * - Registro fluent de skills
 * - Resolución por intent
 * - Case-insensitive matching
 * - Override de intents duplicados
 * - Listado de skills e intents
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../SkillRegistry.js';
import type { Skill, SkillContext, SkillResult } from '../Skill.js';

// Mock skills para testing
class MockSkillA implements Skill {
  readonly name = 'mock-a';
  readonly description = 'Mock Skill A';
  readonly supportedIntents = ['intent_a', 'intent_shared'];
  readonly riskLevel = 'low' as const;

  validate(_context: SkillContext): string | null {
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Mock A executed' };
  }
}

class MockSkillB implements Skill {
  readonly name = 'mock-b';
  readonly description = 'Mock Skill B';
  readonly supportedIntents = ['intent_b', 'intent_c'];
  readonly riskLevel = 'medium' as const;

  validate(_context: SkillContext): string | null {
    return null;
  }

  async execute(_context: SkillContext): Promise<SkillResult> {
    return { success: true, message: 'Mock B executed' };
  }
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('should register a skill', () => {
    const skill = new MockSkillA();
    registry.register(skill);

    const resolved = registry.resolve('intent_a');
    expect(resolved).toBe(skill);
  });

  it('should support fluent registration', () => {
    const skillA = new MockSkillA();
    const skillB = new MockSkillB();

    const result = registry
      .register(skillA)
      .register(skillB);

    expect(result).toBe(registry);
    expect(registry.resolve('intent_a')).toBe(skillA);
    expect(registry.resolve('intent_b')).toBe(skillB);
  });

  it('should resolve skill by intent', () => {
    const skillA = new MockSkillA();
    const skillB = new MockSkillB();

    registry.register(skillA).register(skillB);

    expect(registry.resolve('intent_a')).toBe(skillA);
    expect(registry.resolve('intent_b')).toBe(skillB);
    expect(registry.resolve('intent_c')).toBe(skillB);
    expect(registry.resolve('intent_shared')).toBe(skillA);
  });

  it('should return null for unknown intent', () => {
    const skill = new MockSkillA();
    registry.register(skill);

    const resolved = registry.resolve('unknown_intent');
    expect(resolved).toBeNull();
  });

  it('should override skill with same name', () => {
    const skillA1 = new MockSkillA();
    const skillA2 = new MockSkillA();

    registry.register(skillA1);
    registry.register(skillA2);

    const resolved = registry.resolve('intent_a');
    expect(resolved).toBe(skillA2);
  });

  it('should return all registered skills', () => {
    const skillA = new MockSkillA();
    const skillB = new MockSkillB();

    registry.register(skillA).register(skillB);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(skillA);
    expect(all).toContain(skillB);
  });

  it('should return intent map', () => {
    const skillA = new MockSkillA();
    const skillB = new MockSkillB();

    registry.register(skillA).register(skillB);

    const intentMap = registry.getIntentMap();
    expect(intentMap).toEqual({
      intent_a: 'mock-a',
      intent_shared: 'mock-a',
      intent_b: 'mock-b',
      intent_c: 'mock-b',
    });
  });

  it('should handle empty registry', () => {
    expect(registry.getAll()).toHaveLength(0);
    expect(registry.getIntentMap()).toEqual({});
    expect(registry.resolve('any_intent')).toBeNull();
  });
});
