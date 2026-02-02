import { useState } from "react";

/**
 * AdminPostCard - Wrapper around PostCardV2 grid layout with admin controls
 * 
 * Displays a pending post in a grid card format with:
 * - Checkbox for bulk selection (top-left corner)
 * - Quick action buttons overlay
 * - Click to open modal for detailed editing
 * - Visual indication when selected
 * 
 * @param {object} post - Post object
 * @param {boolean} isSelected - Whether this post is selected
 * @param {function} onToggleSelect - Toggle selection callback
 * @param {function} onSave - Save changes callback
 * @param {function} onPublish - Publish post callback
 * @param {function} onSkip - Skip post callback
 * @param {function} onDelete - Delete post callback
 * @param {function} onClick - Click handler to open modal
 * @param {array} characters - Current characters array (for editing)
 * @param {array} series - Current series array (for editing)
 * @param {function} onCharactersChange - Update characters callback
 * @param {function} onSeriesChange - Update series callback
 */
export default function AdminPostCard({
  post,
  isSelected,
  onToggleSelect,
  onPublish,
  onSkip,
  onDelete,
  onClick,
  characters,
  series,
  tags,
  isSaving,
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate additional image count for badge
  const additionalImageCount =
    post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  const canPublish = characters.length > 0 && series.length > 0;

  return (
    <div
      className={`bg-white rounded-lg overflow-hidden flex flex-col relative transition-all ${
        isSelected ? "ring-4 ring-blue-500 shadow-lg" : "shadow hover:shadow-lg"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox Overlay - Top Left */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="w-6 h-6 cursor-pointer rounded border-2 border-white shadow-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Pending Badge - Top Right */}
      <div className="absolute top-2 right-2 z-10">
        <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded shadow-lg">
          PENDING
        </span>
      </div>

      {/* Saving Indicator */}
      {isSaving && (
        <div className="absolute top-10 right-2 z-10">
          <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded shadow-lg flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        </div>
      )}

      {/* Thumbnail - Clickable to open modal */}
      <div
        className="relative aspect-square cursor-pointer group"
        onClick={onClick}
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
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-semibold">
                +{additionalImageCount}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
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
          </div>
        )}

        {/* Hover overlay with "Click to edit" */}
        {isHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity">
            <span className="text-white font-semibold text-lg">
              Click to edit
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Title and Date */}
        <div className="mb-2">
          <h3 className="font-semibold text-base text-gray-900 line-clamp-2 mb-1">
            {post.title}
          </h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Metadata Preview */}
        <div className="flex-1 mb-3">
          <div className="flex flex-wrap gap-1 text-sm">
            {/* Characters */}
            {characters.map((char, idx) => (
              <span
                key={`char-${idx}`}
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: 'hsl(0deg 75% 36%)', color: '#ffffff' }}
              >
                {char}
              </span>
            ))}

            {/* Series */}
            {series.map((s, idx) => (
              <span
                key={`series-${idx}`}
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: 'hsl(19deg 33% 90%)', color: 'hsl(19deg 33% 20%)' }}
              >
                {s}
              </span>
            ))}

            {/* Tags preview (first 3) */}
            {post.tags?.slice(0, 3).map((tag, idx) => (
              <span
                key={`tag-${idx}`}
                className="px-2 py-0.5 bg-slate-700 text-white rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {post.tags?.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                +{post.tags.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPublish();
            }}
            disabled={!canPublish}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
            title={canPublish ? "Publish post" : "Add characters and series to publish"}
          >
            Publish
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs font-medium"
            title="Skip this post (non-character content)"
          >
            Skip
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
            title="Delete this post"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
