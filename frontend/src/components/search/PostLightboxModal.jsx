import { useState, useEffect } from "react";
import EditSection from "./EditSection";

/**
 * PostLightboxModal component - Full-screen modal for viewing all thumbnails and post details
 *
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Callback to close modal
 * @param {object} post - Current post object
 * @param {array} pendingEdits - Array of pending edits for current post
 * @param {array} allPosts - Array of all posts in results
 * @param {number} currentIndex - Current post index
 * @param {number} currentPage - Current page number
 * @param {number} pageSize - Number of items per page
 * @param {number} totalResults - Total number of results
 * @param {function} onNavigate - Callback to navigate to different post (receives index)
 * @param {function} onEditSuccess - Callback when edit is submitted
 */
export default function PostLightboxModal({
  isOpen,
  onClose,
  post,
  pendingEdits = [],
  allPosts = [],
  currentIndex,
  currentPage = 1,
  pageSize = 20,
  totalResults = 0,
  onNavigate,
  onEditSuccess,
}) {
  const [editSectionOpen, setEditSectionOpen] = useState(true);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < allPosts.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, currentIndex, allPosts.length, onNavigate]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !post) return null;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allPosts.length - 1;

  // Calculate global index for display
  const globalIndex = (currentPage - 1) * pageSize + currentIndex + 1;
  const displayTotal = totalResults > 0 ? totalResults : allPosts.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Title and Date on same line */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
              {post.patreon_url ? (
                <a
                  href={post.patreon_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-bold text-gray-900 hover:text-blue-600 truncate flex items-center gap-2 transition-colors"
                  title="View on Patreon"
                >
                  {post.title}
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ) : (
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {post.title}
                </h2>
              )}
              {post.timestamp && (
                <span className="text-sm text-gray-600 flex-shrink-0">
                  {new Date(post.timestamp).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              title="Close (ESC)"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Thumbnail Grid */}
          {post.thumbnail_urls && post.thumbnail_urls.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Images ({post.thumbnail_urls.length})
              </h3>
              <div className="grid grid-cols-[repeat(auto-fit,200px)] justify-start gap-3 max-h-[600px] overflow-y-auto">
                {post.thumbnail_urls.map((url, idx) => (
                  <div
                    key={idx}
                    className="w-[200px] h-[200px] bg-gray-100 rounded overflow-hidden border border-gray-200"
                  >
                    <img
                      src={url}
                      alt={`${post.title} - Image ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Edit Section */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
            <EditSection
              post={post}
              pendingEdits={pendingEdits}
              onClose={() => setEditSectionOpen(false)}
              onSuccess={(message) => {
                if (onEditSuccess) {
                  onEditSuccess(message);
                }
              }}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              disabled={!hasPrevious}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous post (Left arrow)"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            <span className="text-sm text-gray-600">
              {globalIndex} of {displayTotal}
            </span>

            <button
              onClick={() => onNavigate(currentIndex + 1)}
              disabled={!hasNext}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next post (Right arrow)"
            >
              <span className="hidden sm:inline">Next</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
