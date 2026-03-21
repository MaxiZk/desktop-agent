/**
 * SkillRegistry.ts — Registro central del motor de skills
 *
 * Mantiene un mapa de todas las skills registradas y resuelve
 * qué skill debe manejar un intent dado. Es el único lugar
 * donde se conoce el catálogo completo de skills.
 */

import type { Skill } from './Skill.js';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  /**
   * Registra una skill en el sistema.
   * Si ya existe una skill con el mismo nombre, la sobreescribe.
   */
  register(skill: Skill): this {
    this.skills.set(skill.name, skill);
    console.log(`[SkillRegistry] Registered: ${skill.name} (intents: ${skill.supportedIntents.join(', ')})`);
    return this;
  }

  /**
   * Resuelve qué skill debe manejar un intent dado.
   * Devuelve la primera skill que declara soportar ese intent.
   * Devuelve null si ninguna skill lo maneja.
   */
  resolve(intent: string): Skill | null {
    for (const skill of this.skills.values()) {
      if (skill.supportedIntents.includes(intent)) {
        return skill;
      }
    }
    console.warn(`[SkillRegistry] No skill found for intent: "${intent}"`);
    return null;
  }

  /**
   * Devuelve todas las skills registradas.
   * Útil para generar ayuda dinámica en la UI.
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Devuelve un mapa de intent → nombre de skill.
   * Útil para debugging y para el endpoint /api/skills.
   */
  getIntentMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const skill of this.skills.values()) {
      for (const intent of skill.supportedIntents) {
        map[intent] = skill.name;
      }
    }
    return map;
  }
}

/** Instancia singleton — toda la app comparte el mismo registry */
export const skillRegistry = new SkillRegistry();
