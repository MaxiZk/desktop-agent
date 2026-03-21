/**
 * Ollama Client - AI Integration Module
 * 
 * Provides TypeScript interfaces and types for interacting with the local Ollama AI service.
 * This module defines the contract for making requests to and receiving responses from
 * the Ollama API at http://localhost:11434/api/generate
 */

/**
 * Error type classification for Ollama API interactions
 * 
 * - CONNECTION_FAILED: Cannot connect to Ollama service (service unavailable)
 * - API_ERROR: Ollama service returned an error response
 * - UNKNOWN: Other unexpected errors
 */
export type OllamaErrorType = 'CONNECTION_FAILED' | 'API_ERROR' | 'UNKNOWN';

/**
 * Request payload for Ollama API
 * 
 * @property model - The name of the model to use (e.g., "llama3.2:1b")
 * @property prompt - The text prompt for generation
 * @property stream - Optional flag to enable streaming responses (default: false)
 */
export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

/**
 * Response structure from Ollama API operations
 * 
 * @property success - Whether the request succeeded
 * @property response - Generated text from the model (present if success=true)
 * @property error - Error message (present if success=false)
 * @property errorType - Classification of the error (present if success=false)
 */
export interface OllamaResponse {
  success: boolean;
  response?: string;
  error?: string;
  errorType?: OllamaErrorType;
}

/**
 * Handle streaming response from Ollama API
 * 
 * Reads the response body as a stream of newline-delimited JSON (NDJSON).
 * Each line contains a JSON object with a "response" field containing a chunk of text.
 * Concatenates all chunks into a complete response.
 * 
 * @param response - The fetch Response object with streaming body
 * @returns Promise<OllamaResponse> - Result containing complete generated text or error
 */
async function handleStreamingResponse(response: Response): Promise<OllamaResponse> {
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        error: 'Response body is not readable',
        errorType: 'API_ERROR'
      };
    }

    const decoder = new TextDecoder();
    let completeResponse = '';
    let buffer = '';

    // Read stream chunks
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines in buffer
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      // Process each complete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            if (chunk.response) {
              completeResponse += chunk.response;
            }
          } catch (parseError) {
            // Skip malformed JSON lines
            console.warn('Failed to parse streaming chunk:', line);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.response) {
          completeResponse += chunk.response;
        }
      } catch (parseError) {
        // Skip malformed JSON in final buffer
        console.warn('Failed to parse final streaming chunk:', buffer);
      }
    }

    return {
      success: true,
      response: completeResponse
    };

  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: `Streaming error: ${error.message}`,
        errorType: 'API_ERROR'
      };
    }
    return {
      success: false,
      error: 'Unknown streaming error',
      errorType: 'UNKNOWN'
    };
  }
}

/**
 * Generate AI response using the local Ollama service
 * 
 * Sends a text prompt to the Ollama API and returns the generated response.
 * By default, uses the "llama3.2:1b" model and non-streaming mode.
 * 
 * @param prompt - The text prompt for AI generation
 * @param model - Optional model name (defaults to "llama3.2:1b")
 * @param stream - Optional flag to enable streaming responses (defaults to false)
 * @returns Promise<OllamaResponse> - Result containing generated text or error information
 * 
 * @example
 * ```typescript
 * const result = await generateAIResponse("What is TypeScript?");
 * if (result.success) {
 *   console.log(result.response);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function generateAIResponse(
  prompt: string,
  model: string = 'llama3.2:1b',
  stream: boolean = false
): Promise<OllamaResponse> {
  try {
    // Prepare request payload
    const requestBody: OllamaRequest = {
      model,
      prompt,
      stream
    };

    // Make HTTP POST request to Ollama API
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Handle HTTP error status codes
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Ollama API error (${response.status}): ${errorText}`,
        errorType: 'API_ERROR'
      };
    }

    // Handle streaming responses
    if (stream) {
      return await handleStreamingResponse(response);
    }

    // Parse JSON response for non-streaming mode
    const data = await response.json();

    // Extract generated text from response
    // Ollama API returns the generated text in the "response" field
    if (data.response) {
      return {
        success: true,
        response: data.response
      };
    } else {
      return {
        success: false,
        error: 'No response text in Ollama API response',
        errorType: 'API_ERROR'
      };
    }

  } catch (error) {
    // Handle network errors (connection refused, timeout, etc.)
    if (error instanceof Error) {
      // Check for connection errors
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: `Ollama service unavailable at http://localhost:11434: ${error.message}`,
          errorType: 'CONNECTION_FAILED'
        };
      }

      // Other errors
      return {
        success: false,
        error: `Unexpected error: ${error.message}`,
        errorType: 'UNKNOWN'
      };
    }

    // Non-Error exceptions
    return {
      success: false,
      error: 'Unknown error occurred',
      errorType: 'UNKNOWN'
    };
  }
}
