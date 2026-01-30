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
  onNavigate,
  onEditSuccess,
}) {
  const [editSectionOpen, setEditSectionOpen] = useState(false);

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
            {/* Title and Date */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {post.title}
              </h2>
              {post.timestamp && (
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(post.timestamp).toLocaleDateString()}
                </p>
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
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 max-h-[400px] overflow-y-auto">
                {post.thumbnail_urls.map((url, idx) => (
                  <div
                    key={idx}
                    className="aspect-square bg-gray-100 rounded overflow-hidden"
                  >
                    <img
                      src={url}
                      alt={`${post.title} - Image ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Metadata
            </h3>

            {/* Characters */}
            {post.characters && post.characters.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Characters:{" "}
                </span>
                <span className="text-sm text-gray-900">
                  {post.characters.join(", ")}
                </span>
              </div>
            )}

            {/* Series */}
            {post.series && post.series.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Series:{" "}
                </span>
                <span className="text-sm text-gray-900">
                  {post.series.join(", ")}
                </span>
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-700 block mb-2">
                  Tags:
                </span>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* View on Patreon Link */}
            {post.patreon_url && (
              <div className="pt-3 border-t border-gray-200">
                <a
                  href={post.patreon_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  View on Patreon
                  <svg
                    className="w-4 h-4 ml-2"
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
              </div>
            )}
          </div>

          {/* Edit Section Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setEditSectionOpen(!editSectionOpen)}
              className="w-full md:w-auto px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              {editSectionOpen ? "Hide Edit Section" : "Suggest Edits"}
            </button>
          </div>

          {/* Edit Section */}
          {editSectionOpen && (
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
          )}

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
              {currentIndex + 1} of {allPosts.length}
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
