import PostCard from "./PostCard";

/**
 * SearchResults component - Displays search results with pagination
 * 
 * @param {array} results - Array of post objects (each with pending_edits array)
 * @param {number} total - Total number of results
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message
 * @param {object} pagination - Pagination state {page, limit}
 * @param {function} onPageChange - Callback when page changes
 * @param {function} onEditSuccess - Callback when edit is successfully submitted
 * @param {object} sortParams - Sort parameters {sortBy, sortOrder}
 * @param {function} onSortChange - Callback when sort changes
 */
export default function SearchResults({
  results,
  total,
  loading,
  error,
  pagination,
  onPageChange,
  onEditSuccess,
  sortParams,
  onSortChange,
}) {
  const totalPages = Math.ceil(total / pagination.limit);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Searching...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Results Header with Count and Sort */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-gray-600">
          Found {total} post{total !== 1 ? "s" : ""}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort by:</label>
          <select
            value={`${sortParams.sortBy}-${sortParams.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split("-");
              onSortChange({ sortBy, sortOrder });
            }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((post) => (
          <PostCard
            key={post.post_id}
            post={post}
            pendingEdits={post.pending_edits || []}
            onEditSuccess={onEditSuccess}
          />
        ))}
      </div>

      {/* Pagination */}
      {total > pagination.limit && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-900">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
