/**
 * File Signature (Magic Bytes) Validator
 * Validates file headers to prevent MIME type spoofing and execution of malicious uploads.
 */

export function validateFileSignature(buffer: Buffer): { isValid: boolean; detectedMime?: string } {
  if (!buffer || buffer.length < 12) {
    return { isValid: false };
  }

  // Convert first few bytes to hex
  const hex = buffer.toString('hex', 0, 12).toUpperCase();

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504E470D0A1A0A')) {
    return { isValid: true, detectedMime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (hex.startsWith('FFD8FF')) {
    return { isValid: true, detectedMime: 'image/jpeg' };
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') {
    return { isValid: true, detectedMime: 'image/webp' };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (hex.startsWith('25504446')) {
    return { isValid: true, detectedMime: 'application/pdf' };
  }

  // WebM: 1A 45 DF A3
  if (hex.startsWith('1A45DFA3')) {
    return { isValid: true, detectedMime: 'video/webm' };
  }

  // MP4: 66 74 79 70 (ftyp) at offset 4
  if (hex.slice(8, 16) === '66747970') {
    return { isValid: true, detectedMime: 'video/mp4' };
  }

  return { isValid: false };
}
