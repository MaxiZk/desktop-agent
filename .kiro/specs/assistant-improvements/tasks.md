# Implementation Plan: Assistant Improvements

## Overview

This plan implements three key improvements to the desktop assistant:
1. Neutral identity (remove "Jarvis" references)
2. Context Builder system (RAG-like context enrichment)
3. Security Guard layer (enhanced risk detection with allowlists)

The implementation follows the existing architecture and maintains backward compatibility.

## Tasks

- [x] 1. Update assistant identity to neutral
  - [x] 1.1 Update claude_ai.ts system prompt
    - Replace "Jarvis" with "tu asistente virtual" in system prompt
    - Maintain Spanish (Rioplatense) language
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 Update NarratorService.ts prompts
    - Remove "como Jarvis" from narration prompts
    - Use neutral assistant identity
    - _Requirements: 1.2, 1.4_
  
  - [x] 1.3 Update FreeFormHandler.ts prompts
    - Replace "llamado Jarvis" with neutral identity
    - Update both Claude and Ollama prompts
    - _Requirements: 1.2, 1.5_

- [x] 2. Implement ContextBuilder module
  - [x] 2.1 Create core ContextBuilder class
    - Create `src/core/context/ContextBuilder.ts`
    - Implement interfaces: ContextData, SystemInfo, MemoryEntry, ContextBuilderOptions
    - Implement constructor with options (maxHistoryEntries, maxContextSize, includeSystemInfo)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 2.2 Implement getCommandHistory method
    - Retrieve last N commands from command history
    - Return chronologically ordered array (oldest to newest)
    - Handle empty history gracefully
    - _Requirements: 2.1, 5.1_
  
  - [x] 2.3 Implement getRelevantMemory method
    - Retrieve memory entries based on keyword matching
    - Use case-insensitive matching
    - Return array of MemoryEntry objects
    - _Requirements: 2.4, 2.8_
  
  - [x] 2.4 Implement getSystemInfo method
    - Collect OS, platform, arch, nodeVersion
    - Cache result for performance
    - Return SystemInfo object
    - _Requirements: 2.5_
  
  - [x] 2.5 Implement buildContext method
    - Combine command history, memory, system info
    - Include timestamp in ISO 8601 format
    - Include current intent and active skill
    - Validate context size and truncate if needed
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.9, 5.5_
  
  - [x] 2.6 Implement serializeForAI method
    - Format ContextData as valid JSON string
    - Ensure round-trip compatibility (parse → serialize → parse)
    - _Requirements: 2.7, 5.4, 5.7_
  
  - [x] 2.7 Implement prettyPrint method
    - Format ContextData for debugging
    - Include all fields in readable format
    - _Requirements: 5.6_
  
  - [ ]* 2.8 Write unit tests for ContextBuilder
    - Test empty history handling
    - Test memory keyword matching
    - Test context size limits
    - Test serialization round-trip
    - _Requirements: 2.1, 2.4, 2.8, 2.9, 5.4_
  
  - [ ]* 2.9 Write property test for command history limit
    - **Property 2: Command history retrieval respects limit**
    - **Validates: Requirements 2.1**
    - For any N, getCommandHistory(N) returns at most N entries
  
  - [ ]* 2.10 Write property test for case-insensitive matching
    - **Property 3: Keyword matching is case-insensitive**
    - **Validates: Requirements 2.8**
    - For any keyword, uppercase and lowercase return same results
  
  - [ ]* 2.11 Write property test for context serialization
    - **Property 4: Context serialization produces valid JSON**
    - **Validates: Requirements 5.4**
    - For any ContextData, serializeForAI() produces parseable JSON
  
  - [ ]* 2.12 Write property test for context size bounds
    - **Property 5: Context size is bounded**
    - **Validates: Requirements 2.9**
    - For any ContextData, serialized length ≤ maxContextSize

- [x] 3. Implement Allowlist module
  - [x] 3.1 Create Allowlist class
    - Create `src/core/security/Allowlist.ts`
    - Implement interfaces: AllowlistConfig, AllowlistResult
    - Implement constructor with config (apps, paths)
    - _Requirements: 3.7, 3.8, 3.9_
  
  - [x] 3.2 Implement checkApp method
    - Verify if app name is in allowlist
    - Use case-insensitive matching
    - Return AllowlistResult with matched entry
    - _Requirements: 3.7, 3.8_
  
  - [x] 3.3 Implement checkPath method
    - Verify if file path is in allowlist
    - Support wildcard patterns (*)
    - Use case-insensitive matching
    - _Requirements: 3.7, 3.9_
  
  - [x] 3.4 Implement add and remove methods
    - Add/remove entries from allowlist
    - Prevent duplicates
    - Validate patterns
    - _Requirements: 3.7_
  
  - [x] 3.5 Implement loadFromFile and saveToFile methods
    - Load allowlist from JSON file
    - Save allowlist to JSON file
    - Handle file not found gracefully
    - Validate JSON structure
    - _Requirements: 3.7_
  
  - [x] 3.6 Create default allowlist configuration
    - Create `config/allowlist.json`
    - Include default apps: chrome, notepad, calculator, vscode, excel
    - Include default paths: Desktop/*, Documents/*
    - _Requirements: 3.7, 3.8, 3.9_
  
  - [ ]* 3.7 Write unit tests for Allowlist
    - Test app matching (case-insensitive)
    - Test path matching with wildcards
    - Test add/remove operations
    - Test file load/save
    - _Requirements: 3.7, 3.8, 3.9_
  
  - [ ]* 3.8 Write property test for allowlist bypass
    - **Property 7: Allowlisted items bypass confirmation**
    - **Validates: Requirements 3.7**
    - For any item in allowlist, allowlistBypass should be true

- [x] 4. Implement SecurityGuard module
  - [x] 4.1 Create SecurityGuard class
    - Create `src/core/security/SecurityGuard.ts`
    - Implement interfaces: RiskAssessment, SecurityGuardOptions
    - Implement constructor with RiskGuard and options
    - _Requirements: 3.1, 3.2, 3.10_
  
  - [x] 4.2 Implement assessRisk method
    - Classify actions into LOW, MEDIUM, HIGH risk levels
    - Use risk rules: HIGH (shutdown, restart, file_delete), MEDIUM (open_app, file_create), LOW (read_file, search_files)
    - Check allowlist for bypass
    - Return RiskAssessment with level, reason, requiresConfirmation, allowlistBypass
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.11_
  
  - [x] 4.3 Implement execute method
    - Call assessRisk before executing skill
    - If HIGH risk and not confirmed, require confirmation
    - If allowlist bypass, skip confirmation
    - Execute skill with context
    - Log HIGH risk confirmations
    - _Requirements: 3.3, 3.7, 3.10, 3.12_
  
  - [x] 4.4 Implement isAllowlisted method
    - Check if app or path is in allowlist
    - Return boolean result
    - _Requirements: 3.7_
  
  - [ ]* 4.5 Write unit tests for SecurityGuard
    - Test risk classification (shutdown = HIGH, read_file = LOW)
    - Test confirmation requirement for HIGH risk
    - Test allowlist bypass
    - Test integration with RiskGuard
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 4.6 Write property test for HIGH risk confirmation
    - **Property 6: HIGH risk actions require confirmation**
    - **Validates: Requirements 3.3**
    - For any HIGH risk action, requiresConfirmation should be true (unless allowlist bypass)
  
  - [ ]* 4.7 Write property test for risk classification validity
    - **Property 8: Risk classification is valid**
    - **Validates: Requirements 3.2**
    - For any intent/params, assessRisk() returns 'LOW', 'MEDIUM', or 'HIGH'
  
  - [ ]* 4.8 Write property test for confirmation logging
    - **Property 9: Confirmed HIGH risk actions are logged**
    - **Validates: Requirements 3.12**
    - For any confirmed HIGH risk action, a log entry should exist

- [x] 5. Integrate components in server/index.ts
  - [x] 5.1 Initialize ContextBuilder at server startup
    - Create ContextBuilder instance with default options
    - Cache instance for reuse
    - _Requirements: 2.6, 4.3_
  
  - [x] 5.2 Initialize SecurityGuard at server startup
    - Load allowlist from config/allowlist.json
    - Create SecurityGuard instance with RiskGuard and allowlist
    - Cache instance for reuse
    - _Requirements: 3.10, 4.4_
  
  - [x] 5.3 Integrate ContextBuilder in /api/command
    - Build context before calling AI services
    - Pass enriched context to FreeFormHandler
    - Pass enriched context to NarratorService
    - _Requirements: 2.6, 4.3_
  
  - [x] 5.4 Replace RiskGuard with SecurityGuard in /api/command
    - Use SecurityGuard.execute() instead of RiskGuard.execute()
    - Maintain backward compatibility
    - _Requirements: 3.10, 4.2_
  
  - [ ]* 5.5 Write integration tests for /api/command flow
    - Test context enrichment in AI calls
    - Test security validation in skill execution
    - Test allowlist bypass for approved apps
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Validate implementation
  - [x] 7.1 Run existing test suite
    - Execute `npm test`
    - Verify all existing tests pass
    - _Requirements: 4.6_
  
  - [x] 7.2 Test identity changes manually
    - Send chat request to /api/command
    - Verify response uses neutral identity (no "Jarvis")
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 7.3 Test context enrichment manually
    - Send command to /api/command
    - Verify context includes history, memory, system info
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 7.4 Test security validation manually
    - Send HIGH risk command (shutdown)
    - Verify confirmation is required
    - Send allowlisted app command
    - Verify confirmation is bypassed
    - _Requirements: 3.3, 3.4, 3.5, 3.7_
  
  - [x] 7.5 Run build and verify no errors
    - Execute `npm run build`
    - Verify TypeScript compilation succeeds
    - _Requirements: 4.5_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- The implementation maintains backward compatibility with existing code
