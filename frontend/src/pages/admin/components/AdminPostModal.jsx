import { useState, useEffect, useRef } from "react";
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
  const [publishing, setPublishing] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);

  // Character autocomplete
  const [characterInput, setCharacterInput] = useState("");
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [characterSeriesMap, setCharacterSeriesMap] = useState({});

  // Series autocomplete
  const [seriesInput, setSeriesInput] = useState("");
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);

  // Tags input
  const [tagInput, setTagInput] = useState("");

  // Refs for click-away detection
  const characterRef = useRef(null);
  const seriesRef = useRef(null);

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

  // Fetch character suggestions with series
  const fetchCharacterSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setCharacterSuggestions([]);
      setCharacterSeriesMap({});
      return;
    }

    try {
      const response = await api.get(
        "/api/posts/autocomplete/characters-with-series",
        {
          params: { q: query, limit: 10 },
        },
      );

      const data = response.data || [];
      const charSeriesMap = {};
      const charNames = [];

      data.forEach((item) => {
        charSeriesMap[item.character] = item.series;
        charNames.push(item.character);
      });

      setCharacterSeriesMap(charSeriesMap);
      setCharacterSuggestions(charNames);
    } catch (err) {
      console.error("Failed to fetch character suggestions:", err);
    }
  };

  // Fetch series suggestions
  const fetchSeriesSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSeriesSuggestions([]);
      return;
    }

    try {
      const response = await api.get("/api/posts/autocomplete/series", {
        params: { q: query, limit: 10 },
      });
      setSeriesSuggestions(response.data || []);
    } catch (err) {
      console.error("Failed to fetch series suggestions:", err);
    }
  };

  // Click-away detection for autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        characterRef.current &&
        !characterRef.current.contains(event.target)
      ) {
        setCharacterSuggestions([]);
        setCharacterSeriesMap({});
      }
      if (seriesRef.current && !seriesRef.current.contains(event.target)) {
        setSeriesSuggestions([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (characterInput) fetchCharacterSuggestions(characterInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [characterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (seriesInput) fetchSeriesSuggestions(seriesInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [seriesInput]);

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
                <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
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
                <div className="max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {post.thumbnail_urls.map((url, idx) => (
                      <div
                        key={idx}
                        className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
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
              </div>
            )}

            {/* Editing Section */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Metadata
                </h3>
                <button
                  onClick={handleAutoFill}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
                  title="Auto-fill character and series from title"
                >
                  Auto-fill from Title
                </button>
              </div>

              {/* Characters Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Characters * (Required for publishing)
                </label>
                <div className="relative" ref={characterRef}>
                  <div className="flex gap-2">
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
                          setCharacterSuggestions([]);
                          setCharacterSeriesMap({});
                        }
                      }}
                      placeholder="Type character name and press Enter..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      onClick={() => {
                        if (
                          characterInput.trim() &&
                          !characters.includes(characterInput.trim())
                        ) {
                          onCharactersChange([...characters, characterInput.trim()]);
                          setCharacterInput("");
                          setCharacterSuggestions([]);
                          setCharacterSeriesMap({});
                        }
                      }}
                      disabled={!characterInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {characterSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {characterSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!characters.includes(suggestion)) {
                              onCharactersChange([...characters, suggestion]);
                            }

                            const associatedSeries = characterSeriesMap[suggestion];
                            if (
                              associatedSeries &&
                              !series.includes(associatedSeries)
                            ) {
                              onSeriesChange([...series, associatedSeries]);
                            }

                            setCharacterInput("");
                            setCharacterSuggestions([]);
                            setCharacterSeriesMap({});
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{suggestion}</span>
                            {characterSeriesMap[suggestion] && (
                              <span className="text-xs text-gray-500 ml-2">
                                {characterSeriesMap[suggestion]}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {characters.map((char, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {char}
                      <button
                        onClick={() =>
                          onCharactersChange(characters.filter((_, i) => i !== idx))
                        }
                        className="hover:text-blue-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Series Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Series * (Required for publishing)
                </label>
                <div className="relative" ref={seriesRef}>
                  <div className="flex gap-2">
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
                          setSeriesSuggestions([]);
                        }
                      }}
                      placeholder="Type series name and press Enter..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <button
                      onClick={() => {
                        if (
                          seriesInput.trim() &&
                          !series.includes(seriesInput.trim())
                        ) {
                          onSeriesChange([...series, seriesInput.trim()]);
                          setSeriesInput("");
                          setSeriesSuggestions([]);
                        }
                      }}
                      disabled={!seriesInput.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {seriesSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {seriesSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!series.includes(suggestion)) {
                              onSeriesChange([...series, suggestion]);
                            }
                            setSeriesInput("");
                            setSeriesSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {series.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {s}
                      <button
                        onClick={() =>
                          onSeriesChange(series.filter((_, i) => i !== idx))
                        }
                        className="hover:text-green-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex gap-2">
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
                    placeholder="Type tag and press Enter..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <button
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                        onTagsChange([...tags, tagInput.trim()]);
                        setTagInput("");
                      }
                    }}
                    disabled={!tagInput.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() =>
                          onTagsChange(tags.filter((_, i) => i !== idx))
                        }
                        className="hover:text-purple-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePublish}
                disabled={publishing || !canPublish}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                title={canPublish ? "Publish post" : "Add characters and series to publish"}
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>

              <button
                onClick={handleSkip}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                title="Mark as non-character post (announcement, etc.)"
              >
                Skip Post
              </button>

              <button
                onClick={handleDelete}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete Post
              </button>
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
