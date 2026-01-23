import { useState, useEffect } from "react";
import api from "../../services/api";
import { normalizeText } from "../../utils/validation";

/**
 * EditSection component - Inline expandable section for suggesting edits to a post
 * 
 * @param {object} post - Post object being edited
 * @param {function} onClose - Callback to close the section
 * @param {function} onSuccess - Callback when edit is successfully submitted
 */
export default function EditSection({ post, onClose, onSuccess }) {
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

  // Pending edits state
  const [pendingEdits, setPendingEdits] = useState([]);

  // Fetch pending edits when component mounts
  useEffect(() => {
    if (post) {
      fetchPendingEdits();
    }
  }, [post]);

  const fetchPendingEdits = async () => {
    if (!post) return;
    try {
      const response = await api.get(`/api/edits/pending-for-post/${post.id}`);
      setPendingEdits(response.data || []);
    } catch (err) {
      console.error("Failed to fetch pending edits:", err);
      setPendingEdits([]);
    }
  };

  // Get pending edits for a specific field
  const getPendingEditsForField = (fieldName) => {
    return pendingEdits.filter(edit => edit.field_name === fieldName);
  };

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
      if (fieldType === "characters") setCharacterSuggestions(response.data || []);
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
    }, 300);
    return () => clearTimeout(timer);
  }, [newCharacter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newSeries) {
        fetchSuggestions("series", newSeries);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newSeries]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTag) {
        fetchSuggestions("tags", newTag);
      }
    }, 300);
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

      if (onSuccess) {
        onSuccess(message);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || "Failed to submit edit suggestion");
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
    <div className="border-t border-gray-200 bg-gray-50 transition-all duration-300 ease-in-out overflow-hidden">
      <div className="p-4">
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

        <div className="space-y-3">
          {/* CHARACTERS SECTION - Inline */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700 mr-2">Characters:</span>
            
            {/* Current Characters */}
            {post.characters?.length > 0 &&
              post.characters.map((char, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                >
                  {char}
                  <button
                    onClick={() => handleRemove("characters", char)}
                    className="text-blue-600 hover:text-red-600 transition-colors"
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
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || 'user'}`}
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
                    setCharacterSuggestions
                  )
                }
                placeholder="Add..."
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() =>
                  handleAdd(
                    "characters",
                    newCharacter,
                    setNewCharacter,
                    setCharacterSuggestions
                  )
                }
                disabled={!newCharacter.trim()}
                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <span className="font-semibold text-gray-700 mr-2">Series:</span>
            
            {/* Current Series */}
            {post.series?.length > 0 &&
              post.series.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                >
                  {s}
                  <button
                    onClick={() => handleRemove("series", s)}
                    className="text-green-600 hover:text-red-600 transition-colors"
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
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || 'user'}`}
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
                  handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)
                }
                placeholder="Add..."
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={() =>
                  handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)
                }
                disabled={!newSeries.trim()}
                className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <span className="font-semibold text-gray-700 mr-2">Tags:</span>
            
            {/* Current Tags */}
            {post.tags?.length > 0 &&
              post.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemove("tags", tag)}
                    className="text-purple-600 hover:text-red-600 transition-colors"
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
                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm border border-amber-300"
                title={`Pending ${edit.action.toLowerCase()}: suggested by ${edit.suggester_username || 'user'}`}
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
                  e.key === "Enter" && handleAdd("tags", newTag, setNewTag, setTagSuggestions)
                }
                placeholder="Add..."
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => handleAdd("tags", newTag, setNewTag, setTagSuggestions)}
                disabled={!newTag.trim()}
                className="p-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <p className="text-xs text-blue-800">
            Click × to suggest removing an item, or use + to suggest adding a new one. All suggestions will be reviewed by the community.
          </p>
        </div>
      </div>
    </div>
  );
}
