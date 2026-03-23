# Documento de Requisitos

## Introducción

Este documento define los requisitos para mejorar el asistente de escritorio en tres áreas clave: identidad del asistente, sistema de contexto (tipo RAG), y capa de seguridad para acciones de IA. El objetivo es hacer que el asistente sea más neutral, contextualmente consciente y seguro al ejecutar comandos del usuario.

## Glosario

- **Assistant**: El sistema de asistente de escritorio que procesa comandos en lenguaje natural
- **Context_Builder**: Componente que construye contexto enriquecido antes de enviar solicitudes a la IA
- **Security_Guard**: Componente que valida y clasifica el riesgo de comandos antes de ejecutarlos
- **AI_Service**: Servicios de IA (Claude y Ollama) que procesan lenguaje natural
- **Skill**: Módulo ejecutable que realiza una acción específica del sistema
- **Command_History**: Registro persistente de comandos ejecutados previamente
- **Memory_System**: Sistema de almacenamiento persistente de información del asistente
- **Risk_Level**: Clasificación de riesgo de una acción (LOW, MEDIUM, HIGH)
- **Allowlist**: Lista de aplicaciones o rutas de archivos aprobadas para ejecución sin confirmación

## Requisitos

### Requisito 1: Identidad Neutral del Asistente

**User Story:** Como usuario, quiero que el asistente tenga una identidad neutral, para que no esté asociado con marcas ficticias específicas.

#### Acceptance Criteria

1. THE Assistant SHALL use "Soy tu asistente virtual" as its identity statement
2. WHEN generating conversational responses, THE AI_Service SHALL NOT reference "Jarvis" in system prompts
3. THE Assistant SHALL maintain Spanish (Rioplatense) language in all responses
4. WHEN narrating skill results, THE AI_Service SHALL use neutral assistant identity
5. WHEN handling free-form chat, THE AI_Service SHALL use neutral assistant identity

### Requisito 2: Sistema de Construcción de Contexto

**User Story:** Como usuario, quiero que el asistente tenga acceso a contexto relevante, para que pueda proporcionar respuestas más informadas y personalizadas.

#### Acceptance Criteria

1. THE Context_Builder SHALL retrieve the last N commands from Command_History
2. THE Context_Builder SHALL retrieve assistant responses from Memory_System
3. THE Context_Builder SHALL include current intent and active skill in context
4. THE Context_Builder SHALL retrieve relevant memory entries based on keyword matching
5. THE Context_Builder SHALL include system information (OS, platform) in context
6. WHEN processing a command, THE Assistant SHALL build context before calling AI_Service
7. THE Context_Builder SHALL format context as structured data for AI consumption
8. WHERE keyword matching is used, THE Context_Builder SHALL use case-insensitive matching
9. THE Context_Builder SHALL limit context size to prevent token overflow

### Requisito 3: Capa de Seguridad para Comandos

**User Story:** Como usuario, quiero que el asistente valide comandos riesgosos, para que no se ejecuten acciones destructivas sin mi confirmación.

#### Acceptance Criteria

1. THE Security_Guard SHALL detect risky actions in user commands
2. THE Security_Guard SHALL classify actions into Risk_Level (LOW, MEDIUM, HIGH)
3. WHEN Risk_Level is HIGH, THE Security_Guard SHALL require user confirmation
4. THE Security_Guard SHALL detect shutdown operations as HIGH risk
5. THE Security_Guard SHALL detect file deletion operations as HIGH risk
6. THE Security_Guard SHALL detect unknown application access as MEDIUM risk
7. WHERE an Allowlist exists, THE Security_Guard SHALL bypass confirmation for allowed items
8. THE Security_Guard SHALL support application name allowlists
9. THE Security_Guard SHALL support file path allowlists
10. WHEN integrating with existing RiskGuard, THE Security_Guard SHALL extend its functionality
11. THE Security_Guard SHALL provide descriptive risk warnings to users
12. WHEN a HIGH risk action is confirmed, THE Security_Guard SHALL log the confirmation

### Requisito 4: Integración con Arquitectura Existente

**User Story:** Como desarrollador, quiero que las mejoras se integren sin romper funcionalidad existente, para mantener compatibilidad hacia atrás.

#### Acceptance Criteria

1. THE Assistant SHALL maintain the /api/command endpoint architecture
2. THE Assistant SHALL preserve backward compatibility with existing Skill implementations
3. THE Context_Builder SHALL integrate before AI_Service calls in the request flow
4. THE Security_Guard SHALL integrate with existing RiskGuard without replacing it
5. WHEN building the project, THE Assistant SHALL compile without errors
6. WHEN running tests, THE Assistant SHALL pass all existing test suites

### Requisito 5: Parser de Contexto y Formato

**User Story:** Como desarrollador, quiero que el contexto se formatee correctamente, para que la IA pueda procesarlo de manera efectiva.

#### Acceptance Criteria

1. THE Context_Builder SHALL format command history as chronological list
2. THE Context_Builder SHALL format memory entries as key-value pairs
3. THE Context_Builder SHALL format system info as structured object
4. WHEN serializing context, THE Context_Builder SHALL produce valid JSON
5. FOR ALL valid context objects, THE Context_Builder SHALL include a timestamp
6. THE Context_Builder SHALL include a pretty printer for context debugging
7. FOR ALL valid context objects, building then serializing then parsing SHALL produce an equivalent object (round-trip property)

