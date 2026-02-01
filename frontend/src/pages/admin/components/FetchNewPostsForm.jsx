/**
 * FetchNewPostsForm Component
 *
 * A form component for fetching new posts from Patreon.
 * Displays the latest published date and provides file input for Patreon cookies.
 *
 * @param {Object} props
 * @param {File|null} props.cookieFile - The selected cookie file
 * @param {Function} props.setCookieFile - Function to update cookie file
 * @param {boolean} props.fetching - Whether a fetch operation is in progress
 * @param {string|null} props.latestPublishedDate - ISO date string of the latest published post
 * @param {Function} props.onFetchNew - Callback function to trigger fetching new posts
 */
export default function FetchNewPostsForm({
  cookieFile,
  setCookieFile,
  fetching,
  latestPublishedDate,
  onFetchNew,
}) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCookieFile(file);
    }
  };

  return (
    <div className="mb-6">
      {/* Latest Published Date Display */}
      {latestPublishedDate && (
        <p className="text-sm text-gray-600 mb-4">
          Latest published post:{" "}
          {new Date(latestPublishedDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}

      {/* Fetch New Posts Form */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patreon Cookie File *
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {cookieFile && (
              <p className="text-xs text-green-600 mt-1">
                Selected: {cookieFile.name}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Export cookies from Chrome using: python scripts/export_patreon_cookies.py
            </p>
          </div>
          <div className="pt-7">
            <button
              onClick={onFetchNew}
              disabled={fetching || !cookieFile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {fetching ? "Fetching..." : "Fetch New Posts"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
