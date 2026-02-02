import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "../../../services/api";

/**
 * AdminPostModal - Full-screen modal for editing pending posts
 * 
 * Features:
 * - View all images
 * - Edit characters and series with autocomplete
 * - Auto-fill from title
 * - Save, Publish, Skip, Delete actions
 * - Navigate between posts
 * - Keyboard shortcuts (ESC, arrows)
 */
export default function AdminPostModal({
  post,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  onRemove,
  currentIndex,
  totalPosts,
  characters,
  series,
  tags,
  onCharactersChange,
  onSeriesChange,
  onTagsChange,
  isSaving,
}) {
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);
  const [publishing, setPublishing] = useState(false);

  // Input states for inline editing
  const [characterInput, setCharacterInput] = useState("");
  const [seriesInput, setSeriesInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const canPublish = characters.length > 0 && series.length > 0;

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && onPrevious) {
        onPrevious();
      } else if (e.key === "ArrowRight" && onNext) {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onPrevious, onNext]);

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

  // Auto-fill from title
  const handleAutoFill = () => {
    const title = post.title;

    // Pattern: "Character Name (Series)" or "Character Name (Series) 500 pics"
    const pattern1 = /^([^(]+)\s*\(([^)]+)\)/i;
    const match1 = title.match(pattern1);

    if (match1) {
      const extractedChar = match1[1].trim();
      const extractedSeries = match1[2].trim();

      // Title case the names
      const titleCaseChar = extractedChar
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");

      const titleCaseSeries = extractedSeries
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");

      // Add character if not already present
      if (!characters.includes(titleCaseChar)) {
        onCharactersChange([...characters, titleCaseChar]);
      }

      // Add series if not already present
      if (!series.includes(titleCaseSeries)) {
        onSeriesChange([...series, titleCaseSeries]);
      }

      setModalSuccess("Auto-filled character and series from title!");
      setTimeout(() => setModalSuccess(null), 3000);
      return;
    }

    setModalError(
      "Could not auto-fill: title format not recognized. Expected format: 'Character Name (Series)'",
    );
    setTimeout(() => setModalError(null), 3000);
  };

  // Publish post
  const handlePublish = async () => {
    if (!canPublish) {
      setModalError(
        "Please add at least one character and series before publishing",
      );
      return;
    }

    setPublishing(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      // Save first (including tags)
      await api.patch(`/api/admin/posts/${post.id}`, {
        characters,
        series,
        tags,
      });

      // Then publish
      await api.post(`/api/admin/posts/${post.id}/publish`);

      setModalSuccess("Post published successfully!");
      setTimeout(() => {
        onRemove(post.id);
        onClose();
      }, 1000);
    } catch (err) {
      setModalError(err.response?.data?.detail || "Failed to publish post");
    } finally {
      setPublishing(false);
    }
  };

  // Skip post
  const handleSkip = async () => {
    setModalError(null);
    setModalSuccess(null);

    try {
      await api.post(`/api/admin/posts/${post.id}/skip`);
      setModalSuccess("Post marked as skipped");
      setTimeout(() => {
        onRemove(post.id);
        onClose();
      }, 1500);
    } catch (err) {
      setModalError(err.response?.data?.detail || "Failed to skip post");
    }
  };

  // Delete post
  const handleDelete = async () => {
    setModalError(null);
    setModalSuccess(null);

    try {
      await api.delete(`/api/admin/posts/${post.id}`);
      setModalSuccess("Post deleted");
      setTimeout(() => {
        onRemove(post.id);
        onClose();
      }, 1000);
    } catch (err) {
      setModalError(err.response?.data?.detail || "Failed to delete post");
    }
  };

  if (!isOpen || !post) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="bg-white w-full h-full md:w-11/12 md:h-5/6 md:max-w-6xl md:rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Title and Navigation Info */}
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900 truncate">
                  {post.title}
                </h2>
                <span className={`px-2 py-1 text-white text-xs font-bold rounded ${canPublish ? "bg-green-500" : "bg-yellow-500"}`}>
                  PENDING
                </span>
                {isSaving && (
                  <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                )}
              </div>
              {post.timestamp && (
                <p className="text-sm text-gray-600">
                  Posted: {new Date(post.timestamp).toLocaleDateString()}
                </p>
              )}
              {currentIndex !== undefined && totalPosts !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  Post {currentIndex + 1} of {totalPosts}
                </p>
              )}
            </div>

            {/* Navigation and Close Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevious}
                disabled={!onPrevious}
                className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px]"
                title="Previous post (Left arrow)"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={onNext}
                disabled={!onNext}
                className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px]"
                title="Next post (Right arrow)"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors min-h-[44px] min-w-[44px]"
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
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {/* Success/Error Messages */}
            {modalSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                {modalSuccess}
              </div>
            )}
            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {modalError}
              </div>
            )}

            {/* Thumbnail Grid - Scrollable */}
            {post.thumbnail_urls && post.thumbnail_urls.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Images ({post.thumbnail_urls.length})
                </h3>
                <div className="grid grid-cols-[repeat(auto-fit,200px)] justify-start gap-3 max-h-[750px] overflow-y-auto">
                  {post.thumbnail_urls.map((url, idx) => (
                    <div
                      key={idx}
                      className="w-[200px] h-[200px] bg-gray-100 rounded overflow-hidden"
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

            {/* Editing Section - Compact Inline Style */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Metadata
                </h3>
                <button
                  onClick={handleAutoFill}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium text-sm"
                  title="Auto-fill character and series from title"
                >
                  Auto-fill from Title
                </button>
              </div>

              {/* Compact inline editing - badges first, then inputs */}
              <div className="space-y-2">
                {/* All badges together */}
                <div className="flex flex-wrap gap-1">
                  {/* Characters */}
                  {characters.map((char, idx) => (
                    <span
                      key={`char-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: 'hsl(0deg 75% 36%)', color: '#ffffff' }}
                    >
                      {char}
                      <button
                        onClick={() => onCharactersChange(characters.filter((_, i) => i !== idx))}
                        className="text-white hover:text-red-200 transition-colors"
                        title="Remove this character"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}

                  {/* Series */}
                  {series.map((s, idx) => (
                    <span
                      key={`series-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: 'hsl(19deg 33% 90%)', color: 'hsl(19deg 33% 20%)' }}
                    >
                      {s}
                      <button
                        onClick={() => onSeriesChange(series.filter((_, i) => i !== idx))}
                        className="hover:text-red-600 transition-colors"
                        style={{ color: 'hsl(19deg 33% 20%)' }}
                        title="Remove this series"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}

                  {/* Tags */}
                  {tags.map((tag, idx) => (
                    <span
                      key={`tag-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white rounded text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => onTagsChange(tags.filter((_, i) => i !== idx))}
                        className="text-white hover:text-gray-300 transition-colors"
                        title="Remove this tag"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>

                {/* All inputs in a row */}
                <div className="flex flex-wrap gap-2">
                  {/* Character input */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={characterInput}
                      onChange={(e) => setCharacterInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && characterInput.trim()) {
                          e.preventDefault();
                          if (!characters.includes(characterInput.trim())) {
                            onCharactersChange([...characters, characterInput.trim()]);
                          }
                          setCharacterInput("");
                        }
                      }}
                      placeholder="Add character..."
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-red-600 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        if (characterInput.trim() && !characters.includes(characterInput.trim())) {
                          onCharactersChange([...characters, characterInput.trim()]);
                          setCharacterInput("");
                        }
                      }}
                      disabled={!characterInput.trim()}
                      className="p-1 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: 'hsl(0deg 75% 36%)' }}
                      title="Add character"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Series input */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={seriesInput}
                      onChange={(e) => setSeriesInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && seriesInput.trim()) {
                          e.preventDefault();
                          if (!series.includes(seriesInput.trim())) {
                            onSeriesChange([...series, seriesInput.trim()]);
                          }
                          setSeriesInput("");
                        }
                      }}
                      placeholder="Add series..."
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        if (seriesInput.trim() && !series.includes(seriesInput.trim())) {
                          onSeriesChange([...series, seriesInput.trim()]);
                          setSeriesInput("");
                        }
                      }}
                      disabled={!seriesInput.trim()}
                      className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: 'hsl(19deg 33% 50%)', color: '#ffffff' }}
                      title="Add series"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Tag input */}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && tagInput.trim()) {
                          e.preventDefault();
                          if (!tags.includes(tagInput.trim())) {
                            onTagsChange([...tags, tagInput.trim()]);
                          }
                          setTagInput("");
                        }
                      }}
                      placeholder="Add tag..."
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-slate-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => {
                        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                          onTagsChange([...tags, tagInput.trim()]);
                          setTagInput("");
                        }
                      }}
                      disabled={!tagInput.trim()}
                      className="p-1 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Add tag"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* View on Patreon Link */}
            {post.url && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <a
                  href={post.url}
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
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
