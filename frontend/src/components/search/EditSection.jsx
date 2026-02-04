import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { normalizeText } from "../../utils/validation";

/**
 * EditSection component - Inline expandable section for suggesting edits to a post
 *
 * @param {object} post - Post object being edited
 * @param {array} pendingEdits - Array of pending edits for this post
 * @param {function} onClose - Callback to close the section
 * @param {function} onSuccess - Callback when edit is successfully submitted
 * @param {boolean} compact - If true, hide labels and use longer placeholders
 */
export default function EditSection({
  post,
  pendingEdits = [],
  onClose,
  onSuccess,
  compact = false,
}) {
  // Input states for each field
  const [newCharacter, setNewCharacter] = useState("");
  const [newSeries, setNewSeries] = useState("");
  const [newTag, setNewTag] = useState("");

  // Suggestion states for each field
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  // Success/error messages
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Refs for click-away detection
  const characterInputRef = useRef(null);
  const seriesInputRef = useRef(null);
  const tagInputRef = useRef(null);

  // Get pending edits for a specific field
  const getPendingEditsForField = (fieldName) => {
    return pendingEdits.filter((edit) => edit.field_name === fieldName);
  };

  // Click-away detection to close autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (characterInputRef.current && !characterInputRef.current.contains(event.target)) {
        setCharacterSuggestions([]);
      }
      if (seriesInputRef.current && !seriesInputRef.current.contains(event.target)) {
        setSeriesSuggestions([]);
      }
      if (tagInputRef.current && !tagInputRef.current.contains(event.target)) {
        setTagSuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch autocomplete suggestions
  const fetchSuggestions = async (fieldType, query) => {
    if (!query || query.length < 3) {
      if (fieldType === "characters") setCharacterSuggestions([]);
      if (fieldType === "series") setSeriesSuggestions([]);
      if (fieldType === "tags") setTagSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/api/posts/autocomplete/${fieldType}`, {
        params: { q: query, limit: 100 },
      });
      if (fieldType === "characters")
        setCharacterSuggestions(response.data || []);
      if (fieldType === "series") setSeriesSuggestions(response.data || []);
      if (fieldType === "tags") setTagSuggestions(response.data || []);
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
  };

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newCharacter) {
        fetchSuggestions("characters", newCharacter);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newCharacter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newSeries) {
        fetchSuggestions("series", newSeries);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newSeries]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTag) {
        fetchSuggestions("tags", newTag);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newTag]);

  // Submit edit suggestion
  const submitEdit = async (fieldName, action, value) => {
    setErrorMessage("");
    setSuccessMessage("");

    // Normalize the value
    const normalizedValue = normalizeText(value);

    // Validate normalized value
    if (!normalizedValue) {
      setErrorMessage("Value cannot be empty or whitespace only");
      setTimeout(() => setErrorMessage(""), 5000);
      return;
    }

    try {
      await api.post("/api/edits/suggest", {
        post_id: post.id,
        field_name: fieldName,
        action: action,
        value: normalizedValue,
      });

      const message = `${action === "ADD" ? "Added" : "Removed"} "${normalizedValue}" ${
        action === "ADD" ? "to" : "from"
      } ${fieldName}`;
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(""), 3000);

      // Update local state by adding the pending edit to the pendingEdits array
      // This allows immediate UI update without page reload
      if (onSuccess) {
        onSuccess(message, {
          field_name: fieldName,
          action: action,
          value: normalizedValue,
        });
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || "Failed to submit edit suggestion",
      );
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Handle adding a new item
  const handleAdd = (fieldType, value, clearFunc, clearSuggestionsFunc) => {
    // Normalize before checking
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return;

    submitEdit(fieldType, "ADD", normalizedValue);
    clearFunc("");
    clearSuggestionsFunc([]);
  };

  // Handle removing an item
  const handleRemove = (fieldType, value) => {
    submitEdit(fieldType, "DELETE", value);
  };

  if (!post) return null;

  return (
    <div 
      className="border-t border-gray-200 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      onClick={onClose}
    >
      {/* Content layer - prevent close when clicking interactive elements */}
      <div className="p-4" onClick={(e) => {
        // Only stop propagation if clicking on interactive elements
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('input')) {
          e.stopPropagation();
        }
      }}>
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded mb-3 text-sm transition-all duration-300">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm transition-all duration-300">
            {errorMessage}
          </div>
        )}

        {compact ? (
          /* COMPACT LAYOUT: All badges first, then all inputs */
          <div className="space-y-2">
            {/* All badges together */}
            <div className="flex flex-wrap gap-1">
              {/* Characters */}
              {post.characters?.length > 0 &&
                post.characters.map((char, idx) => (
                  <span
                    key={`char-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'hsl(0deg 75% 36%)', color: '#ffffff' }}
                  >
                    {char}
                    <button
                      onClick={() => handleRemove("characters", char)}
                      className="text-white hover:text-red-200 transition-colors"
                      title="Suggest removing this"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              {getPendingEditsForField("characters").map((edit, idx) => (
                <span
                  key={`char-pending-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                >
                  {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                  <span className="text-xs text-amber-600">(pending)</span>
                </span>
              ))}

              {/* Series */}
              {post.series?.length > 0 &&
                post.series.map((s, idx) => (
                  <span
                    key={`series-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'hsl(19deg 33% 90%)', color: 'hsl(19deg 33% 20%)' }}
                  >
                    {s}
                    <button
                      onClick={() => handleRemove("series", s)}
                      className="hover:text-red-600 transition-colors"
                      style={{ color: 'hsl(19deg 33% 20%)' }}
                      title="Suggest removing this"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              {getPendingEditsForField("series").map((edit, idx) => (
                <span
                  key={`series-pending-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                >
                  {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                  <span className="text-xs text-amber-600">(pending)</span>
                </span>
              ))}

              {/* Tags */}
              {post.tags?.length > 0 &&
                post.tags.map((tag, idx) => (
                  <span
                    key={`tag-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white rounded text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemove("tags", tag)}
                      className="text-white hover:text-gray-300 transition-colors"
                      title="Suggest removing this"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              {getPendingEditsForField("tags").map((edit, idx) => (
                <span
                  key={`tag-pending-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                >
                  {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                  <span className="text-xs text-amber-600">(pending)</span>
                </span>
              ))}
            </div>

            {/* All inputs in a row */}
            <div className="flex flex-wrap gap-2">
              {/* Character input */}
              <div ref={characterInputRef} className="relative inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newCharacter}
                  onChange={(e) => setNewCharacter(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    handleAdd("characters", newCharacter, setNewCharacter, setCharacterSuggestions)
                  }
                  placeholder="Add character..."
                  className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-red-600 focus:border-transparent"
                />
                <button
                  onClick={() => handleAdd("characters", newCharacter, setNewCharacter, setCharacterSuggestions)}
                  disabled={!newCharacter.trim()}
                  className="p-1 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: 'hsl(0deg 75% 36%)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(0deg 75% 30%)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(0deg 75% 36%)'}
                  title="Add character"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {characterSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {characterSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNewCharacter(suggestion);
                          setCharacterSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Series input */}
              <div ref={seriesInputRef} className="relative inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newSeries}
                  onChange={(e) => setNewSeries(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)
                  }
                  placeholder="Add series..."
                  className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)}
                  disabled={!newSeries.trim()}
                  className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: 'hsl(19deg 33% 50%)', color: '#ffffff' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(19deg 33% 45%)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(19deg 33% 50%)'}
                  title="Add series"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {seriesSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {seriesSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNewSeries(suggestion);
                          setSeriesSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tag input */}
              <div ref={tagInputRef} className="relative inline-flex items-center gap-1">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    handleAdd("tags", newTag, setNewTag, setTagSuggestions)
                  }
                  placeholder="Add tag..."
                  className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-slate-500 focus:border-transparent"
                />
                <button
                  onClick={() => handleAdd("tags", newTag, setNewTag, setTagSuggestions)}
                  disabled={!newTag.trim()}
                  className="p-1 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Add tag"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {tagSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNewTag(suggestion);
                          setTagSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* FULL LAYOUT: Separate sections with labels */
          <div className="space-y-3">
          {/* CHARACTERS SECTION - Inline */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700 text-xs mr-2">
              Characters:
            </span>

            {/* Current Characters */}
            {post.characters?.length > 0 &&
              post.characters.map((char, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: 'hsl(0deg 75% 36%)', color: '#ffffff' }}
                >
                  {char}
                  <button
                    onClick={() => handleRemove("characters", char)}
                    className="text-white hover:text-red-200 transition-colors"
                    title="Suggest removing this"
                  >
                    <svg
                      className="w-3 h-3"
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
                </span>
              ))}

            {/* Pending Character Edits */}
            {getPendingEditsForField("characters").map((edit, idx) => (
              <span
                key={`pending-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || "user"}`}
              >
                {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                <span className="text-xs text-amber-600">(pending)</span>
              </span>
            ))}

            {/* Add New Character */}
            <div className="relative inline-flex items-center gap-1">
              <input
                type="text"
                value={newCharacter}
                onChange={(e) => setNewCharacter(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  handleAdd(
                    "characters",
                    newCharacter,
                    setNewCharacter,
                    setCharacterSuggestions,
                  )
                }
                placeholder={compact ? "Add character..." : "Add..."}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-red-600 focus:border-transparent"
              />
              <button
                onClick={() =>
                  handleAdd(
                    "characters",
                    newCharacter,
                    setNewCharacter,
                    setCharacterSuggestions,
                  )
                }
                disabled={!newCharacter.trim()}
                className="p-1 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'hsl(0deg 75% 36%)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(0deg 75% 30%)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(0deg 75% 36%)'}
                title="Add character"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>

              {/* Autocomplete for Characters */}
              {characterSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {characterSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setNewCharacter(suggestion);
                        setCharacterSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SERIES SECTION - Inline */}
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <span className="font-semibold text-gray-700 text-xs mr-2">Series:</span>
            )}

            {/* Current Series */}
            {post.series?.length > 0 &&
              post.series.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: 'hsl(19deg 33% 90%)', color: 'hsl(19deg 33% 20%)' }}
                >
                  {s}
                  <button
                    onClick={() => handleRemove("series", s)}
                    className="hover:text-red-600 transition-colors"
                    style={{ color: 'hsl(19deg 33% 20%)' }}
                    title="Suggest removing this"
                  >
                    <svg
                      className="w-3 h-3"
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
                </span>
              ))}

            {/* Pending Series Edits */}
            {getPendingEditsForField("series").map((edit, idx) => (
              <span
                key={`pending-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || "user"}`}
              >
                {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                <span className="text-xs text-amber-600">(pending)</span>
              </span>
            ))}

            {/* Add New Series */}
            <div className="relative inline-flex items-center gap-1">
              <input
                type="text"
                value={newSeries}
                onChange={(e) => setNewSeries(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  handleAdd(
                    "series",
                    newSeries,
                    setNewSeries,
                    setSeriesSuggestions,
                  )
                }
                placeholder={compact ? "Add series..." : "Add..."}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={() =>
                  handleAdd(
                    "series",
                    newSeries,
                    setNewSeries,
                    setSeriesSuggestions,
                  )
                }
                disabled={!newSeries.trim()}
                className="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'hsl(19deg 33% 50%)', color: '#ffffff' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(19deg 33% 45%)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(19deg 33% 50%)'}
                title="Add series"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>

              {/* Autocomplete for Series */}
              {seriesSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {seriesSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setNewSeries(suggestion);
                        setSeriesSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TAGS SECTION - Inline */}
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <span className="font-semibold text-gray-700 text-xs mr-2">Tags:</span>
            )}

            {/* Current Tags */}
            {post.tags?.length > 0 &&
              post.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white rounded text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleRemove("tags", tag)}
                    className="text-white hover:text-gray-300 transition-colors"
                    title="Suggest removing this"
                  >
                    <svg
                      className="w-3 h-3"
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
                </span>
              ))}

            {/* Pending Tag Edits */}
            {getPendingEditsForField("tags").map((edit, idx) => (
              <span
                key={`pending-${idx}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || "user"}`}
              >
                {edit.action === "ADD" ? `+${edit.value}` : `−${edit.value}`}
                <span className="text-xs text-amber-600">(pending)</span>
              </span>
            ))}

            {/* Add New Tag */}
            <div className="relative inline-flex items-center gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  handleAdd("tags", newTag, setNewTag, setTagSuggestions)
                }
                placeholder={compact ? "Add tag..." : "Add..."}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-600 focus:ring-1 focus:ring-slate-500 focus:border-transparent"
              />
              <button
                onClick={() =>
                  handleAdd("tags", newTag, setNewTag, setTagSuggestions)
                }
                disabled={!newTag.trim()}
                className="p-1 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Add tag"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>

              {/* Autocomplete for Tags */}
              {tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {tagSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setNewTag(suggestion);
                        setTagSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <p className="text-xs text-blue-800">
            Click × to suggest removing an item, or use + to suggest adding a
            new one. All suggestions will be reviewed by the community.
          </p>
        </div>
      </div>
    </div>
  );
}
