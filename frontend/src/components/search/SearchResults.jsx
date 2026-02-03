import { useState, useEffect, useRef } from "react";
import PostCardV2 from "./PostCardV2";
import PostLightboxModal from "./PostLightboxModal";
import { useAuth } from "../../contexts/AuthContext";

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
  const [modalState, setModalState] = useState({ isOpen: false, postIndex: null });
  const [localResults, setLocalResults] = useState(results);
  const totalPages = Math.ceil(total / pagination.limit);
  const { isAdmin } = useAuth();
  
  // Track pending navigation after page change
  const pendingNavigationRef = useRef(null);

  // Update local results when results prop changes
  useEffect(() => {
    setLocalResults(results);
    
    // If there's a pending navigation, execute it now that results have loaded
    if (pendingNavigationRef.current !== null && results.length > 0) {
      let targetIndex = pendingNavigationRef.current;
      
      // Handle sentinel value: -1 means "go to last item"
      if (targetIndex === -1) {
        targetIndex = results.length - 1;
      }
      
      pendingNavigationRef.current = null; // Clear pending navigation
      
      // Navigate to the target index
      setModalState({ isOpen: true, postIndex: targetIndex });
    }
  }, [results]);

  const handleThumbnailClick = (index) => {
    setModalState({ isOpen: true, postIndex: index });
  };

  const handleModalNavigate = (newIndex) => {
    setModalState({ isOpen: true, postIndex: newIndex });
  };

  const handleModalClose = () => {
    setModalState({ isOpen: false, postIndex: null });
  };

  // Handle page change from modal with navigation to specific index
  const handleModalPageChange = async (newPage) => {
    // Determine where to navigate after page loads
    const wasAtEnd = modalState.postIndex === localResults.length - 1;
    const wasAtStart = modalState.postIndex === 0;
    
    // Set pending navigation: 0 for start of new page, -1 for end of new page
    if (wasAtEnd) {
      // Was at end of previous page, go to start of new page
      pendingNavigationRef.current = 0;
    } else if (wasAtStart) {
      // Was at start of previous page, go to end of new page
      // We'll calculate the actual index when results load (use -1 as sentinel)
      pendingNavigationRef.current = -1;
    }
    
    // Change the page - this will trigger results to update
    await onPageChange(newPage);
  };

  // Handle edit success by updating local state
  const handleLocalEditSuccess = (message, editData) => {
    if (editData) {
      setLocalResults((prevResults) => {
        // Find the post by post_id from editData or use modalState.postIndex
        let postIndex = modalState.postIndex;
        
        // If we don't have a modal index, find the post by post_id
        if (postIndex === null && editData.post_id) {
          postIndex = prevResults.findIndex(p => p.post_id === editData.post_id);
        }
        
        if (postIndex !== null && postIndex >= 0) {
          const post = prevResults[postIndex];
          
          // If user is admin, apply the edit directly to the post fields
          // Otherwise, add to pending_edits
          let updatedPost;
          if (isAdmin()) {
            // Admin: Apply edit immediately to actual post fields
            const fieldName = editData.field_name;
            const action = editData.action;
            const value = editData.value;
            
            if (action === 'ADD') {
              // Add value to the field array if not already present
              updatedPost = {
                ...post,
                [fieldName]: post[fieldName]?.includes(value) 
                  ? post[fieldName] 
                  : [...(post[fieldName] || []), value]
              };
            } else if (action === 'DELETE') {
              // Remove value from the field array
              updatedPost = {
                ...post,
                [fieldName]: (post[fieldName] || []).filter(v => v !== value)
              };
            }
          } else {
            // Non-admin: Add to pending_edits
            updatedPost = {
              ...post,
              pending_edits: [...(post.pending_edits || []), editData]
            };
          }
          
          // Create a completely new array with the updated post object
          return prevResults.map((p, idx) => {
            if (idx === postIndex) {
              return updatedPost;
            }
            return p;
          });
        }
        
        return prevResults;
      });
    }
    
    // Still call the parent callback for any other side effects (like showing a toast)
    // but don't trigger a full reload
    if (onEditSuccess) {
      onEditSuccess(message, false); // Pass false to indicate no reload needed
    }
  };

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
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No results found
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Results Header with Count and Sort */}
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="text-gray-600">
          Found {total} post{total !== 1 ? "s" : ""}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">Sort by:</label>
          <select
            value={`${sortParams.sortBy}-${sortParams.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split("-");
              onSortChange({ sortBy, sortOrder });
            }}
            className="w-full sm:w-auto px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Results Grid - responsive columns that fill width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {results.map((post, index) => (
          <PostCardV2
            key={post.post_id}
            post={post}
            pendingEdits={post.pending_edits || []}
            onEditSuccess={handleLocalEditSuccess}
            onThumbnailClick={() => handleThumbnailClick(index)}
          />
        ))}
      </div>

      {/* Pagination */}
      {total > pagination.limit && (
        <div className="flex justify-center items-center gap-2 mt-8">
          {/* Previous Button */}
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-3 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 min-h-[44px]"
            aria-label="Previous page"
          >
            ←
          </button>

          {/* Page Numbers */}
          {(() => {
            const pages = [];
            const maxVisible = 7;
            const current = pagination.page;

            if (totalPages <= maxVisible) {
              // Show all pages
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              // Show with ellipsis
              if (current <= 4) {
                // Near start: 1 2 3 4 5 ... 20
                for (let i = 1; i <= 5; i++) {
                  pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
              } else if (current >= totalPages - 3) {
                // Near end: 1 ... 16 17 18 19 20
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                  pages.push(i);
                }
              } else {
                // In middle: 1 ... 5 6 7 ... 20
                pages.push(1);
                pages.push('...');
                for (let i = current - 1; i <= current + 1; i++) {
                  pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
              }
            }

            return pages.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-4 py-3 text-gray-900 flex items-center min-h-[44px]"
                  >
                    ...
                  </span>
                );
              }

              const isCurrentPage = page === current;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  disabled={isCurrentPage}
                  className={`px-4 py-3 rounded min-h-[44px] ${
                    isCurrentPage
                      ? 'bg-blue-600 text-white cursor-default'
                      : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                  }`}
                  aria-label={`Page ${page}`}
                  aria-current={isCurrentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            });
          })()}

          {/* Next Button */}
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="px-4 py-3 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 min-h-[44px]"
            aria-label="Next page"
          >
            →
          </button>
        </div>
      )}

      {/* Post Lightbox Modal */}
      {modalState.isOpen && modalState.postIndex !== null && (
        <PostLightboxModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          post={localResults[modalState.postIndex]}
          pendingEdits={localResults[modalState.postIndex]?.pending_edits || []}
          allPosts={localResults}
          currentIndex={modalState.postIndex}
          onNavigate={handleModalNavigate}
          onEditSuccess={handleLocalEditSuccess}
          onPageChange={handleModalPageChange}
          currentPage={pagination.page}
          pageSize={pagination.limit}
          totalResults={total}
        />
      )}
    </>
  );
}
