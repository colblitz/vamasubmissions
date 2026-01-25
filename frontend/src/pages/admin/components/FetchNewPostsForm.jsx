/**
 * FetchNewPostsForm Component
 * 
 * A form component for fetching new posts from Patreon.
 * Displays the latest published date and provides input for the Patreon session_id cookie.
 * 
 * @param {Object} props
 * @param {string} props.sessionIdInput - The current session_id input value
 * @param {Function} props.setSessionIdInput - Function to update session_id input
 * @param {boolean} props.fetching - Whether a fetch operation is in progress
 * @param {string|null} props.latestPublishedDate - ISO date string of the latest published post
 * @param {Function} props.onFetchNew - Callback function to trigger fetching new posts
 */
export default function FetchNewPostsForm({
  sessionIdInput,
  setSessionIdInput,
  fetching,
  latestPublishedDate,
  onFetchNew,
}) {
  return (
    <div className="mb-6">
      {/* Latest Published Date Display */}
      {latestPublishedDate && (
        <p className="text-sm text-gray-600 mb-4">
          Latest published post: {new Date(latestPublishedDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      )}

      {/* Fetch New Posts Form */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patreon session_id cookie *
            </label>
            <input
              type="text"
              value={sessionIdInput}
              onChange={(e) => setSessionIdInput(e.target.value)}
              placeholder="Patreon session_id cookie..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your session_id cookie from patreon.com while logged in
            </p>
          </div>
          <div className="pt-7">
            <button
              onClick={onFetchNew}
              disabled={fetching || !sessionIdInput.trim()}
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
