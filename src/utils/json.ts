/**
 * Safely parses JSON strings returned by AI LLMs.
 * Removes markdown wrappers and recovers from formatting errors using fallbacks.
 */
export function safeParseJson<T>(text: string, fallback: T): T {
  if (!text || typeof text !== 'string') {
    return fallback;
  }

  let cleaned = text.trim();

  try {
    // 1. Try to extract content inside markdown json blocks
    const markdownRegex = /```json\s*([\s\S]*?)\s*```/i;
    const match = cleaned.match(markdownRegex);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      // 2. Try generic markdown code blocks if no json label is provided
      const genericCodeRegex = /```\s*([\s\S]*?)\s*```/i;
      const genericMatch = cleaned.match(genericCodeRegex);
      if (genericMatch && genericMatch[1]) {
        cleaned = genericMatch[1].trim();
      }
    }

    // 3. Find structural boundaries if there is leading/trailing conversational noise
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      let startIndex = -1;
      let endIndex = -1;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
        endIndex = cleaned.lastIndexOf('}');
      } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        endIndex = cleaned.lastIndexOf(']');
      }

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
      }
    }

    // Clean up trailing commas or stray backticks
    cleaned = cleaned
      .replace(/,(\s*[}\]])/g, '$1') // remove trailing commas before closing braces/brackets
      .trim();

    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('safeParseJson error. Failed to parse string:');
    console.error(text);
    console.error('Details:', error);
    return fallback;
  }
}
