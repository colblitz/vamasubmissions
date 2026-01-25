/**
 * Validation utilities for input normalization and sanitization.
 */

/**
 * Normalize text input:
 * - Trim leading/trailing whitespace
 * - Normalize unicode to NFC form
 * - Return null if empty after normalization
 *
 * @param {string|null|undefined} text - Input string to normalize
 * @returns {string|null} Normalized string or null if empty
 *
 * @example
 * normalizeText("  Hello  ") // "Hello"
 * normalizeText("   ") // null
 * normalizeText(null) // null
 */
export function normalizeText(text) {
  if (!text) return null;

  // Trim whitespace
  text = text.trim();

  // Return null if empty
  if (!text) return null;

  // Normalize unicode to NFC form (canonical composition)
  // This ensures consistent representation of accented characters
  text = text.normalize("NFC");

  return text;
}

/**
 * Normalize array of strings:
 * - Apply normalizeText to each item
 * - Remove empty values
 * - Remove case-insensitive duplicates (keeps first occurrence)
 *
 * @param {string[]|null|undefined} items - Array of strings to normalize
 * @returns {string[]} Normalized, deduplicated array
 *
 * @example
 * normalizeArrayField(["  Naruto  ", "naruto", "Sasuke"]) // ["Naruto", "Sasuke"]
 * normalizeArrayField(["", "  ", "Valid"]) // ["Valid"]
 * normalizeArrayField(null) // []
 */
export function normalizeArrayField(items) {
  if (!items || !Array.isArray(items)) return [];

  const normalized = [];
  const seenLower = new Set();

  for (const item of items) {
    const normalizedItem = normalizeText(item);
    if (normalizedItem) {
      const lowerItem = normalizedItem.toLowerCase();
      if (!seenLower.has(lowerItem)) {
        normalized.push(normalizedItem);
        seenLower.add(lowerItem);
      }
    }
  }

  return normalized;
}
