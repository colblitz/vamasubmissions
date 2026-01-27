import { useState } from "react";
import EditSection from "./EditSection";

/**
 * MobilePostCard component - Mobile-optimized post card (< 768px)
 * 
 * Key differences from desktop PostCard:
 * - Smaller thumbnail (w-24 h-24) on left with object-contain
 * - Title is clickable link with external icon
 * - No "View on Patreon" button (title serves this purpose)
 * - "Suggest Edit" button always visible and functional
 *
 * @param {object} post - Post object with title, characters, series, tags, etc.
 * @param {array} pendingEdits - Array of pending edit suggestions for this post
 * @param {function} onEditSuccess - Callback when edit is successfully submitted
 */
export default function MobilePostCard({ post, pendingEdits = [], onEditSuccess }) {
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  
  // Helper to get pending edits for a specific field
  const getPendingEditsForField = (fieldName) => {
    return pendingEdits.filter((edit) => edit.field_name === fieldName);
  };

  // Get pending additions for a field
  const getPendingAdditions = (fieldName) => {
    return getPendingEditsForField(fieldName).filter(
      (edit) => edit.action === "ADD",
    );
  };

  // Get pending deletions for a field
  const getPendingDeletions = (fieldName) => {
    return getPendingEditsForField(fieldName).filter(
      (edit) => edit.action === "DELETE",
    );
  };

  // Check if a value is pending deletion
  const isPendingDeletion = (fieldName, value) => {
    return getPendingDeletions(fieldName).some((edit) => edit.value === value);
  };

  const handleCardClick = () => {
    setEditSectionOpen(!editSectionOpen);
  };

  const handleTitleClick = (e) => {
    // Prevent card click when clicking title
    e.stopPropagation();
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
      <div 
        className="flex flex-row cursor-pointer active:bg-gray-50"
        onClick={handleCardClick}
      >
        {/* Thumbnail - Small, on left, object-contain */}
        {post.thumbnail_urls?.[0] ? (
          <img
            src={post.thumbnail_urls[0]}
            alt={post.title}
            loading="lazy"
            className="w-24 flex-shrink-0 object-contain border-r border-gray-200"
          />
        ) : (
          <div className="w-24 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-r border-gray-200">
            <div className="text-center px-2">
              <svg
                className="w-8 h-8 mx-auto mb-1 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-gray-400 text-xs">No preview</span>
            </div>
          </div>
        )}

        <div className="p-3 flex-1 flex flex-col min-w-0">
          {/* Title (clickable) and Date */}
          <div className="flex justify-between items-start mb-1 gap-2">
            <a 
              href={post.patreon_url} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleTitleClick}
              className="font-semibold text-base text-gray-900 hover:text-blue-600 flex items-start gap-1 min-w-0"
            >
              <span className="break-words">{post.title}</span>
              <svg
                className="w-4 h-4 flex-shrink-0 mt-0.5"
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
            {post.timestamp && (
              <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                {new Date(post.timestamp).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Metadata with Pending Edits */}
          <div className="space-y-1 flex-1 text-sm">
            {/* Characters */}
            {(post.characters?.length > 0 ||
              getPendingAdditions("characters").length > 0) && (
              <div>
                <span className="text-xs font-medium text-gray-600">
                  Characters:{" "}
                </span>
                <span className="text-xs text-gray-900">
                  {post.characters?.map((char, idx) => {
                    const isDeleting = isPendingDeletion("characters", char);
                    return (
                      <span key={idx}>
                        {idx > 0 && ", "}
                        {isDeleting ? (
                          <span className="line-through text-gray-400">
                            {char}{" "}
                            <span className="text-xs text-amber-600">
                              (pending removal)
                            </span>
                          </span>
                        ) : (
                          char
                        )}
                      </span>
                    );
                  })}
                  {getPendingAdditions("characters").length > 0 && (
                    <>
                      {post.characters?.length > 0 && ", "}
                      {getPendingAdditions("characters").map((edit, idx) => (
                        <span key={`pending-${idx}`}>
                          {idx > 0 && ", "}
                          <span className="text-amber-600">
                            {edit.value}{" "}
                            <span className="text-xs">(pending)</span>
                          </span>
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Series */}
            {(post.series?.length > 0 ||
              getPendingAdditions("series").length > 0) && (
              <div>
                <span className="text-xs font-medium text-gray-600">
                  Series:{" "}
                </span>
                <span className="text-xs text-gray-900">
                  {post.series?.map((s, idx) => {
                    const isDeleting = isPendingDeletion("series", s);
                    return (
                      <span key={idx}>
                        {idx > 0 && ", "}
                        {isDeleting ? (
                          <span className="line-through text-gray-400">
                            {s}{" "}
                            <span className="text-xs text-amber-600">
                              (pending removal)
                            </span>
                          </span>
                        ) : (
                          s
                        )}
                      </span>
                    );
                  })}
                  {getPendingAdditions("series").length > 0 && (
                    <>
                      {post.series?.length > 0 && ", "}
                      {getPendingAdditions("series").map((edit, idx) => (
                        <span key={`pending-${idx}`}>
                          {idx > 0 && ", "}
                          <span className="text-amber-600">
                            {edit.value}{" "}
                            <span className="text-xs">(pending)</span>
                          </span>
                        </span>
                      ))}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Tags */}
            {(post.tags?.length > 0 ||
              getPendingAdditions("tags").length > 0) && (
              <div>
                <span className="text-xs font-medium text-gray-600">
                  Tags:{" "}
                </span>
                <div className="inline-flex flex-wrap gap-1">
                  {post.tags?.map((tag, idx) => {
                    const isDeleting = isPendingDeletion("tags", tag);
                    return (
                      <span
                        key={idx}
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          isDeleting
                            ? "bg-gray-200 text-gray-400 line-through"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tag}
                        {isDeleting && (
                          <span className="ml-1 text-amber-600 no-underline">
                            (pending removal)
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {getPendingAdditions("tags").map((edit, idx) => (
                    <span
                      key={`pending-${idx}`}
                      className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs"
                    >
                      {edit.value} <span className="text-xs">(pending)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Section */}
      {editSectionOpen && (
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
      )}
    </div>
  );
}
