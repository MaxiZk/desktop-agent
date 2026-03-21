# Implementation Plan: Backend Structure

## Overview

This implementation plan creates a modular, skill-based backend architecture for a React frontend application. The backend provides six core modules: Windows app launcher, file reader, CSV analyzer, Ollama AI client, memory store, and a central backend service that exports all capabilities. All modules use TypeScript for type safety and follow a consistent error handling pattern with structured result objects.

## Tasks

- [x] 1. Set up project dependencies and directory structure
  - Install required npm packages: papaparse, @types/papaparse, fast-check, vitest, @types/node
  - Create directory structure: src/backend/, src/skills/, src/ai/, src/memory/
  - Create __tests__ subdirectories for each module
  - Configure vitest for test execution
  - _Requirements: 7.1, 8.7_

- [ ] 2. Implement Windows App Launcher module
  - [x] 2.1 Create TypeScript interfaces and types for Windows App Launcher
    - Define CommandResult interface with success, message, and error fields
    - Export interface for use by other modules
    - _Requirements: 8.2, 2.5_
  
  - [x] 2.2 Implement openCalculator and openNotepad functions
    - Use Node.js child_process.exec() to execute Windows commands
    - Execute "calc" command for Calculator
    - Execute "notepad" command for Notepad
    - Wrap execution in Promise for async handling
    - Return CommandResult with success flag and message
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.3 Implement error handling for command execution
    - Catch child_process.exec() errors
    - Handle command not found errors
    - Handle permission denied errors
    - Return structured error with descriptive message
    - _Requirements: 1.4, 2.5_
  
  - [ ]* 2.4 Write unit tests for Windows App Launcher
    - Test openCalculator returns success
    - Test openNotepad returns success
    - Test invalid application returns error
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [ ]* 2.5 Write property test for command execution
    - **Property 1: Command Execution Returns Results**
    - **Validates: Requirements 1.3**
    - Generate valid Windows commands, verify result structure
  
  - [ ]* 2.6 Write property test for failed commands
    - **Property 2: Failed Commands Return Errors**
    - **Validates: Requirements 1.4**
    - Generate invalid commands, verify error results with success=false
  
  - [ ]* 2.7 Write property test for application launch failures
    - **Property 3: Application Launch Failures Return Errors**
    - **Validates: Requirements 2.5**
    - Generate invalid application names, verify error returns

- [ ] 3. Implement File Reader module
  - [x] 3.1 Create TypeScript interfaces and types for File Reader
    - Define FileReadResult interface with success, content, error, and errorType fields
    - Define errorType union type: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN'
    - Export interfaces for use by other modules
    - _Requirements: 8.3, 3.3, 3.4_
  
  - [x] 3.2 Implement readFile function
    - Use Node.js fs.promises.readFile() for async file reading
    - Specify UTF-8 encoding explicitly
    - Return FileReadResult with file content on success
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x] 3.3 Implement error handling for file operations
    - Catch file system errors from fs.promises.readFile()
    - Classify errors by error code (ENOENT → NOT_FOUND, EACCES → PERMISSION_DENIED)
    - Return FileReadResult with appropriate errorType
    - Include descriptive error messages with file path
    - _Requirements: 3.3, 3.4_
  
  - [ ]* 3.4 Write unit tests for File Reader
    - Test reading existing file returns content
    - Test non-existent file returns NOT_FOUND error
    - Test empty file returns empty string with success=true
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 3.5 Write property test for file reading
    - **Property 4: File Reading Returns Content**
    - **Validates: Requirements 3.1, 3.2**
    - Create temporary files with random content, read them, verify content matches
  
  - [ ]* 3.6 Write property test for UTF-8 preservation
    - **Property 5: UTF-8 Files Preserve Content**
    - **Validates: Requirements 3.5**
    - Generate random UTF-8 strings including non-ASCII characters, write to file, read back, verify equality

- [ ] 4. Implement CSV Analyzer module
  - [x] 4.1 Create TypeScript interfaces and types for CSV Analyzer
    - Define CSVRow interface with dynamic string/number keys
    - Define CSVAnalysisResult interface with success, data, headers, rowCount, and error fields
    - Export interfaces for use by other modules
    - _Requirements: 8.4, 4.2_
  
  - [x] 4.2 Implement analyzeCSV function
    - Read file using fs.promises.readFile()
    - Use papaparse library to parse CSV content
    - Configure papaparse with header detection, auto-delimiter detection, skip empty lines
    - Extract headers from parsed result
    - Return CSVAnalysisResult with structured data, headers, and row count
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  
  - [x] 4.3 Implement error handling for CSV parsing
    - Handle file reading errors (delegate to file system error handling)
    - Catch papaparse parsing errors
    - Return CSVAnalysisResult with error message from parser
    - Distinguish between file access errors and parsing errors
    - _Requirements: 4.4_
  
  - [ ]* 4.4 Write unit tests for CSV Analyzer
    - Test CSV with headers is parsed correctly
    - Test CSV with comma delimiter is parsed
    - Test CSV with semicolon delimiter is parsed
    - Test CSV with tab delimiter is parsed
    - Test empty CSV file returns empty array
    - Test malformed CSV returns error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 4.5 Write property test for CSV parsing
    - **Property 6: CSV Parsing Returns Structured Data**
    - **Validates: Requirements 4.2**
    - Generate random valid CSV content, parse it, verify structured array output
  
  - [ ]* 4.6 Write property test for CSV headers
    - **Property 7: CSV Headers Are Extracted**
    - **Validates: Requirements 4.3**
    - Generate CSV with random headers, verify headers are extracted and used as object keys
  
  - [ ]* 4.7 Write property test for malformed CSV
    - **Property 8: Malformed CSV Returns Error**
    - **Validates: Requirements 4.4**
    - Generate invalid CSV content, verify error result
  
  - [ ]* 4.8 Write property test for multiple delimiters
    - **Property 9: Multiple Delimiters Are Supported**
    - **Validates: Requirements 4.5**
    - Generate same data with different delimiters (comma, semicolon, tab), verify equivalent parsed output

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Ollama AI Client module
  - [x] 6.1 Create TypeScript interfaces and types for Ollama Client
    - Define OllamaRequest interface with model, prompt, and stream fields
    - Define OllamaResponse interface with success, response, error, and errorType fields
    - Define errorType union type: 'CONNECTION_FAILED' | 'API_ERROR' | 'UNKNOWN'
    - Export interfaces for use by other modules
    - _Requirements: 8.5, 5.1, 5.2_
  
  - [x] 6.2 Implement generateAIResponse function
    - Use fetch() API to make HTTP POST requests to http://localhost:11434/api/generate
    - Default model to "llama2" (configurable via parameter)
    - Send request with model, prompt, and stream=false
    - Parse JSON response and extract generated text
    - Return OllamaResponse with generated text
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 6.3 Implement streaming response support
    - For streaming requests, set stream=true in request body
    - Read response body as stream
    - Concatenate all streamed chunks into complete response
    - Return OllamaResponse with complete generated text
    - _Requirements: 5.6_
  
  - [x] 6.4 Implement error handling for Ollama requests
    - Catch network errors from fetch() (connection refused, timeout)
    - Handle HTTP error status codes (4xx, 5xx)
    - Parse error messages from Ollama API responses
    - Return OllamaResponse with appropriate errorType
    - _Requirements: 5.4, 5.5_
  
  - [ ]* 6.5 Write unit tests for Ollama Client
    - Test valid prompt returns generated text (requires Ollama service running)
    - Test Ollama service unavailable returns CONNECTION_FAILED error
    - Test streaming mode returns complete response
    - _Requirements: 5.3, 5.4, 5.6_
  
  - [ ]* 6.6 Write property test for Ollama responses
    - **Property 10: Ollama Responses Return Generated Text**
    - **Validates: Requirements 5.3**
    - Send random prompts to Ollama (if available), verify response contains text
  
  - [ ]* 6.7 Write property test for Ollama errors
    - **Property 11: Ollama Errors Are Propagated**
    - **Validates: Requirements 5.5**
    - Trigger Ollama errors, verify error details are returned
  
  - [ ]* 6.8 Write property test for streaming responses
    - **Property 12: Streaming Responses Are Supported**
    - **Validates: Requirements 5.6**
    - Send prompts with streaming enabled, verify complete response

- [ ] 7. Implement Memory Store module
  - [x] 7.1 Create TypeScript interfaces and types for Memory Store
    - Define MemoryData interface with flexible key-value structure
    - Define MemorySaveResult interface with success and error fields
    - Define MemoryLoadResult interface with success, data, error, and errorType fields
    - Define errorType union type: 'NOT_FOUND' | 'PARSE_ERROR' | 'UNKNOWN'
    - Export interfaces for use by other modules
    - _Requirements: 8.6, 6.1, 6.3_
  
  - [x] 7.2 Implement saveMemory function
    - Use Node.js fs.promises.writeFile() for saving
    - Use JSON.stringify() with 2-space indentation for readability
    - Default memory file location: ./memory.json in project root
    - Return MemorySaveResult with success flag
    - _Requirements: 6.1, 6.2_
  
  - [x] 7.3 Implement loadMemory function
    - Use Node.js fs.promises.readFile() for loading
    - Use JSON.parse() to deserialize
    - If file doesn't exist, return empty object {} with success=true
    - Return MemoryLoadResult with memory data
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [x] 7.4 Implement error handling for memory operations
    - For save: catch file write errors
    - For load: catch JSON parsing errors and return PARSE_ERROR type
    - Ensure corrupted files don't crash the application
    - Support nested object structures (no depth limit)
    - _Requirements: 6.6, 6.7_
  
  - [ ]* 7.5 Write unit tests for Memory Store
    - Test save and load simple object succeeds
    - Test save and load nested object succeeds
    - Test load non-existent file returns empty object
    - Test load corrupted JSON returns PARSE_ERROR
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 7.6 Write property test for memory round trip
    - **Property 13: Memory Storage Round Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7**
    - Generate random JSON-serializable objects (including nested structures), save and load, verify equality

- [ ] 8. Implement Backend Service orchestration module
  - [x] 8.1 Create backend/index.ts with re-exports
    - Re-export openCalculator and openNotepad from skills/open_windows_app
    - Re-export readFile from skills/read_file
    - Re-export analyzeCSV from skills/analyze_csv
    - Re-export generateAIResponse from ai/ollama_ai
    - Re-export saveMemory and loadMemory from memory/local_memory
    - No business logic (pure re-export module)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 8.2 Write unit tests for Backend Service
    - Test all skill functions are exported
    - Verify each exported function is accessible
    - _Requirements: 7.1_
  
  - [ ]* 8.3 Write property test for module import side effects
    - **Property 14: Module Import Has No Side Effects**
    - **Validates: Requirements 7.7**
    - Import modules in isolated environment, verify no file system changes or command executions

- [x] 9. Final checkpoint - Ensure all tests pass and integration is complete
  - Run all unit tests and property-based tests
  - Verify TypeScript compilation succeeds without errors
  - Ensure all modules are properly wired together
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases using Vitest
- All modules use TypeScript for compile-time type safety
- Error handling follows consistent pattern: structured result objects with success flags
- No module executes side effects on import (all functionality is explicit function calls)
