import { useState } from "react";
import EditSection from "./EditSection";

/**
 * PostCardV2 component - Grid layout based on Option D (TwoColumnGridDemo)
 *
 * @param {object} post - Post object with title, characters, series, tags, thumbnail_urls, timestamp, etc.
 * @param {array} pendingEdits - Array of pending edit suggestions for this post
 * @param {function} onEditSuccess - Callback when edit is successfully submitted
 * @param {function} onThumbnailClick - Callback when thumbnail is clicked (opens modal)
 */
export default function PostCardV2({
  post,
  pendingEdits = [],
  onEditSuccess,
  onThumbnailClick,
}) {
  const [showingEdit, setShowingEdit] = useState(false);

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

  // Calculate additional image count for badge
  const additionalImageCount =
    post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  // Handle edit success
  const handleEditSuccess = (message) => {
    if (onEditSuccess) {
      onEditSuccess(message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div
        className="relative aspect-square cursor-pointer group"
        onClick={onThumbnailClick}
      >
        {post.thumbnail_urls?.[0] ? (
          <>
            <img
              src={post.thumbnail_urls[0]}
              alt={post.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
            {additionalImageCount > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-semibold">
                +{additionalImageCount}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No preview</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Title and Date */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-base text-gray-900 line-clamp-2 flex-1">
            {post.title}
          </h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Metadata or Edit Section - Toggle between them */}
        {!showingEdit ? (
          <div
            className="flex-1 cursor-pointer hover:bg-gray-50 transition-colors p-2 -m-2 rounded"
            onClick={() => setShowingEdit(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowingEdit(true);
              }
            }}
            aria-label="Click to suggest edits"
          >
            {/* All badges inline - no labels */}
            <div className="flex flex-wrap gap-1 text-sm">
              {/* Characters (blue) */}
              {post.characters?.map((char, idx) => {
                const isDeleting = isPendingDeletion("characters", char);
                return (
                  <span
                    key={`char-${idx}`}
                    className={`px-2 py-0.5 rounded text-xs ${
                      isDeleting
                        ? "bg-gray-200 text-gray-400 line-through"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {char}
                    {isDeleting && (
                      <span className="ml-1 text-amber-600 no-underline">
                        (pending removal)
                      </span>
                    )}
                  </span>
                );
              })}
              {getPendingAdditions("characters").map((edit, idx) => (
                <span
                  key={`char-pending-${idx}`}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs"
                >
                  {edit.value} <span className="text-xs">(pending)</span>
                </span>
              ))}

              {/* Series (purple) */}
              {post.series?.map((s, idx) => {
                const isDeleting = isPendingDeletion("series", s);
                return (
                  <span
                    key={`series-${idx}`}
                    className={`px-2 py-0.5 rounded text-xs ${
                      isDeleting
                        ? "bg-gray-200 text-gray-400 line-through"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {s}
                    {isDeleting && (
                      <span className="ml-1 text-amber-600 no-underline">
                        (pending removal)
                      </span>
                    )}
                  </span>
                );
              })}
              {getPendingAdditions("series").map((edit, idx) => (
                <span
                  key={`series-pending-${idx}`}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs"
                >
                  {edit.value} <span className="text-xs">(pending)</span>
                </span>
              ))}

              {/* Tags (gray) */}
              {post.tags?.slice(0, 5).map((tag, idx) => {
                const isDeleting = isPendingDeletion("tags", tag);
                return (
                  <span
                    key={`tag-${idx}`}
                    className={`px-2 py-0.5 rounded text-xs ${
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
              {post.tags?.length > 5 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                  +{post.tags.length - 5}
                </span>
              )}
              {getPendingAdditions("tags").map((edit, idx) => (
                <span
                  key={`tag-pending-${idx}`}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs"
                >
                  {edit.value} <span className="text-xs">(pending)</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <EditSection
              post={post}
              pendingEdits={pendingEdits}
              onClose={() => setShowingEdit(false)}
              onSuccess={handleEditSuccess}
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 justify-between items-center">
          <a
            href={post.patreon_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium min-h-[44px] flex items-center"
          >
            View on Patreon →
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowingEdit(!showingEdit);
            }}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium min-h-[44px]"
          >
            {showingEdit ? "View Metadata" : "Suggest Edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
