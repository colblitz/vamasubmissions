import { useState } from "react";
import EditSection from "./EditSection";

/**
 * PostCard component - Displays a single post with metadata and pending edits
 * 
 * @param {object} post - Post object with title, characters, series, tags, etc.
 * @param {array} pendingEdits - Array of pending edit suggestions for this post
 * @param {function} onEditSuccess - Callback when edit is successfully submitted
 */
export default function PostCard({ post, pendingEdits = [], onEditSuccess }) {
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  // Helper to get pending edits for a specific field
  const getPendingEditsForField = (fieldName) => {
    return pendingEdits.filter(edit => edit.field_name === fieldName);
  };

  // Get pending additions for a field
  const getPendingAdditions = (fieldName) => {
    return getPendingEditsForField(fieldName).filter(edit => edit.action === "ADD");
  };

  // Get pending deletions for a field
  const getPendingDeletions = (fieldName) => {
    return getPendingEditsForField(fieldName).filter(edit => edit.action === "DELETE");
  };

  // Check if a value is pending deletion
  const isPendingDeletion = (fieldName, value) => {
    return getPendingDeletions(fieldName).some(edit => edit.value === value);
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
      <div className="flex">
      {/* Thumbnail */}
      {post.thumbnail_urls?.[0] ? (
        <img
          src={post.thumbnail_urls[0]}
          alt={post.title}
          loading="lazy"
          className="w-48 h-48 flex-shrink-0 object-cover border-r border-gray-200"
        />
      ) : (
        <div className="w-48 h-48 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-r border-gray-200">
          <div className="text-center px-4">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-gray-400"
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

      <div className="p-4 flex-1 flex flex-col">
        {/* Title and Date */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-xl text-gray-900">{post.title}</h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Metadata with Pending Edits */}
        <div className="space-y-2 flex-1">
          {/* Characters */}
          {(post.characters?.length > 0 || getPendingAdditions("characters").length > 0) && (
            <div>
              <span className="text-sm font-medium text-gray-600">Characters: </span>
              <span className="text-sm text-gray-900">
                {post.characters?.map((char, idx) => {
                  const isDeleting = isPendingDeletion("characters", char);
                  return (
                    <span key={idx}>
                      {idx > 0 && ", "}
                      {isDeleting ? (
                        <span className="line-through text-gray-400">
                          {char} <span className="text-xs text-amber-600">(pending removal)</span>
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
                          {edit.value} <span className="text-xs">(pending)</span>
                        </span>
                      </span>
                    ))}
                  </>
                )}
              </span>
            </div>
          )}

          {/* Series */}
          {(post.series?.length > 0 || getPendingAdditions("series").length > 0) && (
            <div>
              <span className="text-sm font-medium text-gray-600">Series: </span>
              <span className="text-sm text-gray-900">
                {post.series?.map((s, idx) => {
                  const isDeleting = isPendingDeletion("series", s);
                  return (
                    <span key={idx}>
                      {idx > 0 && ", "}
                      {isDeleting ? (
                        <span className="line-through text-gray-400">
                          {s} <span className="text-xs text-amber-600">(pending removal)</span>
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
                          {edit.value} <span className="text-xs">(pending)</span>
                        </span>
                      </span>
                    ))}
                  </>
                )}
              </span>
            </div>
          )}

          {/* Tags */}
          {(post.tags?.length > 0 || getPendingAdditions("tags").length > 0) && (
            <div>
              <span className="text-sm font-medium text-gray-600">Tags: </span>
              <div className="inline-flex flex-wrap gap-1">
                {post.tags?.map((tag, idx) => {
                  const isDeleting = isPendingDeletion("tags", tag);
                  return (
                    <span
                      key={idx}
                      className={`px-2 py-1 rounded text-xs ${
                        isDeleting
                          ? "bg-gray-200 text-gray-400 line-through"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {tag}
                      {isDeleting && (
                        <span className="ml-1 text-amber-600 no-underline">(pending removal)</span>
                      )}
                    </span>
                  );
                })}
                {getPendingAdditions("tags").map((edit, idx) => (
                  <span
                    key={`pending-${idx}`}
                    className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs"
                  >
                    {edit.value} <span className="text-xs">(pending)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View on Patreon
            <svg
              className="w-4 h-4 ml-1"
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

          <button
            onClick={() => setEditSectionOpen(!editSectionOpen)}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
          >
            {editSectionOpen ? "Close Edit" : "Suggest Edit"}
          </button>
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
            setEditSectionOpen(false);
            if (onEditSuccess) {
              onEditSuccess(message);
            }
          }}
        />
      )}
    </div>
  );
}
