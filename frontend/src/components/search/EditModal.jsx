import { useState, useEffect } from "react";
import api from "../../services/api";

/**
 * EditModal component - Modal for suggesting edits to a post
 * 
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Callback to close modal
 * @param {object} post - Post object being edited
 * @param {function} onSuccess - Callback when edit is successfully submitted
 */
export default function EditModal({ isOpen, onClose, post, onSuccess }) {
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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewCharacter("");
      setNewSeries("");
      setNewTag("");
      setCharacterSuggestions([]);
      setSeriesSuggestions([]);
      setTagSuggestions([]);
      setSuccessMessage("");
      setErrorMessage("");
    }
  }, [isOpen]);

  // Pending edits state
  const [pendingEdits, setPendingEdits] = useState([]);

  // Fetch pending edits when modal opens
  useEffect(() => {
    if (isOpen && post) {
      fetchPendingEdits();
    }
  }, [isOpen, post]);

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
        params: { q: query, limit: 100 },  // Substring matching: worst case "a" = 310 matches
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
      if (newCharacter && isOpen) {
        fetchSuggestions("characters", newCharacter);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newCharacter, isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newSeries && isOpen) {
        fetchSuggestions("series", newSeries);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newSeries, isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTag && isOpen) {
        fetchSuggestions("tags", newTag);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newTag, isOpen]);

  // Submit edit suggestion
  const submitEdit = async (fieldName, action, value) => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await api.post("/api/edits/suggest", {
        post_id: post.id,
        field_name: fieldName,
        action: action,
        value: value.trim(),
      });

      const message = `${action === "ADD" ? "Added" : "Removed"} "${value}" ${
        action === "ADD" ? "to" : "from"
      } ${fieldName}`;
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(""), 3000);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || "Failed to submit edit suggestion");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Handle adding a new item
  const handleAdd = (fieldType, value, clearFunc, clearSuggestionsFunc) => {
    if (!value.trim()) return;
    submitEdit(fieldType, "ADD", value);
    clearFunc("");
    clearSuggestionsFunc([]);
  };

  // Handle removing an item
  const handleRemove = (fieldType, value) => {
    submitEdit(fieldType, "DELETE", value);
  };

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Suggest Edit</h2>
              <p className="text-sm text-gray-600 mt-1">{post.title}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            {/* CHARACTERS SECTION */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Characters</h3>
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  {/* Current Characters */}
                  {post.characters?.length > 0 &&
                    post.characters.map((char, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-md text-sm hover:bg-red-50 transition-colors"
                      >
                        {char}
                        <button
                          onClick={() => handleRemove("characters", char)}
                          className="text-blue-400 hover:text-red-600 transition-colors"
                          title="Suggest removing this"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}

                  {/* Add New Character - Inline */}
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
                      placeholder="Add character..."
                      className="w-40 px-2.5 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
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
                      className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-4 h-4"
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
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SERIES SECTION */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Series</h3>
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  {/* Current Series */}
                  {post.series?.length > 0 &&
                    post.series.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-800 rounded-md text-sm hover:bg-red-50 transition-colors"
                      >
                        {s}
                        <button
                          onClick={() => handleRemove("series", s)}
                          className="text-green-400 hover:text-red-600 transition-colors"
                          title="Suggest removing this"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}

                  {/* Add New Series - Inline */}
                  <div className="relative inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newSeries}
                      onChange={(e) => setNewSeries(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)
                      }
                      placeholder="Add series..."
                      className="w-40 px-2.5 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                    />
                    <button
                      onClick={() =>
                        handleAdd("series", newSeries, setNewSeries, setSeriesSuggestions)
                      }
                      disabled={!newSeries.trim()}
                      className="p-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-4 h-4"
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
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* TAGS SECTION */}
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tags</h3>
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  {/* Current Tags */}
                  {post.tags?.length > 0 &&
                    post.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 rounded-md text-sm hover:bg-red-50 transition-colors"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemove("tags", tag)}
                          className="text-purple-400 hover:text-red-600 transition-colors"
                          title="Suggest removing this"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}

                  {/* Add New Tag - Inline */}
                  <div className="relative inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleAdd("tags", newTag, setNewTag, setTagSuggestions)
                      }
                      placeholder="Add tag..."
                      className="w-40 px-2.5 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                    />
                    <button
                      onClick={() => handleAdd("tags", newTag, setNewTag, setTagSuggestions)}
                      disabled={!newTag.trim()}
                      className="p-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-4 h-4"
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
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900 text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Click the × button to suggest removing an item, or use the + button to suggest
              adding a new one. All suggestions will be reviewed by the community.
            </p>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
