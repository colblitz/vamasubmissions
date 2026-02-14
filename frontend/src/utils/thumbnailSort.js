/**
 * Extract ordinal from thumbnail filename
 * Format: [postid]-t-[ordinal]-[uuid].ext
 * Example: 122097057-t-000-1b73c5f0.png -> 0
 *
 * @param {string} url - Thumbnail URL or filename
 * @returns {number} - Ordinal number, or Infinity if not found (sorts to end)
 */
export function extractOrdinal(url) {
  if (!url) return Infinity;

  // Extract filename from URL
  const filename = url.split("/").pop();

  // Match pattern: anything-t-[digits]-anything
  const match = filename.match(/-t-(\d+)-/);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // If pattern doesn't match, return Infinity (sorts to end)
  return Infinity;
}

/**
 * Sort thumbnail URLs by ordinal
 * Maintains original order if ordinals can't be extracted
 *
 * @param {Array<string>} thumbnailUrls - Array of thumbnail URLs
 * @returns {Array<string>} - Sorted array
 */
export function sortThumbnails(thumbnailUrls) {
  if (!thumbnailUrls || thumbnailUrls.length === 0) {
    return thumbnailUrls;
  }

  // Create array of [url, ordinal, originalIndex] tuples
  const withOrdinals = thumbnailUrls.map((url, idx) => ({
    url,
    ordinal: extractOrdinal(url),
    originalIndex: idx,
  }));

  // Sort by ordinal, then by original index (stable sort)
  withOrdinals.sort((a, b) => {
    if (a.ordinal !== b.ordinal) {
      return a.ordinal - b.ordinal;
    }
    return a.originalIndex - b.originalIndex;
  });

  // Return sorted URLs
  return withOrdinals.map((item) => item.url);
}
