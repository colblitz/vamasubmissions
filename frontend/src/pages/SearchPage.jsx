import { useState, useEffect } from "react";
import api from "../services/api";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useState({
    query: "",
    characters: [],
    series: [],
    tags: [],
    page: 1,
    limit: 20,
  });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Edit suggestion modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editSuccess, setEditSuccess] = useState("");
  const [editError, setEditError] = useState("");

  // Separate input states for each field
  const [newCharacter, setNewCharacter] = useState("");
  const [newSeries, setNewSeries] = useState("");
  const [newTag, setNewTag] = useState("");

  // Separate suggestion states for each field
  const [characterModalSuggestions, setCharacterModalSuggestions] = useState([]);
  const [seriesModalSuggestions, setSeriesModalSuggestions] = useState([]);
  const [tagModalSuggestions, setTagModalSuggestions] = useState([]);

  // Autocomplete states
  const [characterInput, setCharacterInput] = useState("");
  const [seriesInput, setSeriesInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  // Fetch autocomplete suggestions
  const fetchAutocomplete = async (type, query) => {
    if (!query || query.length < 2) {
      // Clear suggestions when query is too short
      if (type === "characters") setCharacterSuggestions([]);
      if (type === "series") setSeriesSuggestions([]);
      if (type === "tags") setTagSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/api/posts/autocomplete/${type}`, {
        params: { q: query, limit: 10 },
      });

      // Backend returns a plain array, not { suggestions: [...] }
      // Use empty array to show "no results" vs null to hide dropdown
      if (type === "characters") setCharacterSuggestions(response.data || []);
      if (type === "series") setSeriesSuggestions(response.data || []);
      if (type === "tags") setTagSuggestions(response.data || []);
    } catch (err) {
      console.error(`Autocomplete error for ${type}:`, err);
    }
  };

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (characterInput) fetchAutocomplete("characters", characterInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [characterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (seriesInput) fetchAutocomplete("series", seriesInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [seriesInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tagInput) fetchAutocomplete("tags", tagInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [tagInput]);

  // Search posts
  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: searchParams.page,
        limit: searchParams.limit,
      };

      // Add query if present (API expects 'q' not 'query')
      if (searchParams.query?.trim()) {
        params.q = searchParams.query.trim();
      }

      // Add filters if present
      if (searchParams.characters.length > 0) {
        params.characters = searchParams.characters.join(",");
      }
      if (searchParams.series.length > 0) {
        params.series = searchParams.series.join(",");
      }
      if (searchParams.tags.length > 0) {
        params.tags = searchParams.tags.join(",");
      }

      const response = await api.get("/api/posts/search", { params });

      // Backend returns 'posts' not 'results'
      setResults(response.data.posts || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Add filter chip
  const addFilter = (type, value) => {
    setSearchParams((prev) => ({
      ...prev,
      [type]: [...prev[type], value],
      page: 1,
    }));

    // Clear input and suggestions
    if (type === "characters") {
      setCharacterInput("");
      setCharacterSuggestions([]);
    }
    if (type === "series") {
      setSeriesInput("");
      setSeriesSuggestions([]);
    }
    if (type === "tags") {
      setTagInput("");
      setTagSuggestions([]);
    }
  };

  // Remove filter chip
  const removeFilter = (type, value) => {
    setSearchParams((prev) => ({
      ...prev,
      [type]: prev[type].filter((v) => v !== value),
      page: 1,
    }));
  };

  // Auto-search when filters change
  useEffect(() => {
    if (
      searchParams.characters.length > 0 ||
      searchParams.series.length > 0 ||
      searchParams.tags.length > 0
    ) {
      handleSearch();
    }
  }, [searchParams]);

  // Open edit modal
  const openEditModal = (post) => {
    setSelectedPost(post);
    setNewCharacter("");
    setNewSeries("");
    setNewTag("");
    setCharacterModalSuggestions([]);
    setSeriesModalSuggestions([]);
    setTagModalSuggestions([]);
    setEditModalOpen(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedPost(null);
    setNewCharacter("");
    setNewSeries("");
    setNewTag("");
    setCharacterModalSuggestions([]);
    setSeriesModalSuggestions([]);
    setTagModalSuggestions([]);
  };

  // Fetch suggestions for modal (for each field type)
  const fetchModalSuggestions = async (fieldType, query) => {
    if (!query || query.length < 2) {
      if (fieldType === "characters") setCharacterModalSuggestions([]);
      if (fieldType === "series") setSeriesModalSuggestions([]);
      if (fieldType === "tags") setTagModalSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/api/posts/autocomplete/${fieldType}`, {
        params: { q: query, limit: 10 },
      });
      if (fieldType === "characters") setCharacterModalSuggestions(response.data || []);
      if (fieldType === "series") setSeriesModalSuggestions(response.data || []);
      if (fieldType === "tags") setTagModalSuggestions(response.data || []);
    } catch (err) {
      console.error("Autocomplete error:", err);
    }
  };

  // Debounced autocomplete for modal - characters
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newCharacter && editModalOpen) {
        fetchModalSuggestions("characters", newCharacter);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newCharacter, editModalOpen]);

  // Debounced autocomplete for modal - series
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newSeries && editModalOpen) {
        fetchModalSuggestions("series", newSeries);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newSeries, editModalOpen]);

  // Debounced autocomplete for modal - tags
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTag && editModalOpen) {
        fetchModalSuggestions("tags", newTag);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newTag, editModalOpen]);

  // Submit edit suggestion (add or remove)
  const submitEdit = async (fieldName, action, value) => {
    setEditError("");
    setEditSuccess("");
    
    try {
      await api.post("/api/edits/suggest", {
        post_id: selectedPost.id,
        field_name: fieldName,
        action: action,
        value: value.trim(),
      });

      setEditSuccess(
        `${action === "ADD" ? "Added" : "Removed"} "${value}" ${action === "ADD" ? "to" : "from"} ${fieldName}`
      );
      setTimeout(() => setEditSuccess(""), 3000);
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to submit edit suggestion");
      setTimeout(() => setEditError(""), 5000);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Search Posts</h1>

      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-4">
          {/* Title Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Title
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchParams.query}
                onChange={(e) =>
                  setSearchParams((prev) => ({ ...prev, query: e.target.value, page: 1 }))
                }
                onKeyPress={(e) => {
                  if (e.key === "Enter" && searchParams.query.trim()) {
                    handleSearch();
                  }
                }}
                placeholder="Search post titles..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={handleSearch}
                disabled={!searchParams.query.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Search
              </button>
              {searchParams.query && (
                <button
                  onClick={() => {
                    setSearchParams((prev) => ({ ...prev, query: "", page: 1 }));
                    setResults([]);
                    setTotal(0);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Search across post titles, characters, series, and tags
            </p>
          </div>

          {/* Characters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Characters</label>
            <div className="relative">
              <input
                type="text"
                value={characterInput}
                onChange={(e) => setCharacterInput(e.target.value)}
                placeholder="Type to search characters..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              {characterInput.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {characterSuggestions.length > 0 ? (
                    characterSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => addFilter("characters", suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No characters found</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchParams.characters.map((char, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {char}
                  <button
                    onClick={() => removeFilter("characters", char)}
                    className="hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Series */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Series</label>
            <div className="relative">
              <input
                type="text"
                value={seriesInput}
                onChange={(e) => setSeriesInput(e.target.value)}
                placeholder="Type to search series..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              {seriesInput.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {seriesSuggestions.length > 0 ? (
                    seriesSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => addFilter("series", suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No series found</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchParams.series.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {s}
                  <button
                    onClick={() => removeFilter("series", s)}
                    className="hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Type to search tags..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              {tagInput.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {tagSuggestions.length > 0 ? (
                    tagSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => addFilter("tags", suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-500 text-sm">No tags found</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchParams.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => removeFilter("tags", tag)}
                    className="hover:text-purple-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Searching...</p>
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <div className="mb-4 text-gray-600">
              Found {total} post{total !== 1 ? "s" : ""}
            </div>
          )}

          {/* Single column layout - one post per row */}
          <div className="space-y-4">
            {results.map((post) => (
              <div
                key={post.post_id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex overflow-hidden"
              >
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
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-xl text-gray-900">{post.title}</h3>
                    {post.timestamp && (
                      <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                        {new Date(post.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {post.characters?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Characters: </span>
                        <span className="text-sm text-gray-900">{post.characters.join(", ")}</span>
                      </div>
                    )}

                    {post.series?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Series: </span>
                        <span className="text-sm text-gray-900">{post.series.join(", ")}</span>
                      </div>
                    )}

                    {post.tags?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Tags: </span>
                        <div className="inline-flex flex-wrap gap-1">
                          {post.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

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
                      onClick={() => openEditModal(post)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
                    >
                      Suggest Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > searchParams.limit && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() =>
                  setSearchParams((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                disabled={searchParams.page === 1}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-900">
                Page {searchParams.page} of {Math.ceil(total / searchParams.limit)}
              </span>
              <button
                onClick={() => setSearchParams((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={searchParams.page >= Math.ceil(total / searchParams.limit)}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Suggestion Modal - All Fields on One Page */}
      {editModalOpen && selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Suggest Edit</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedPost.title}</p>
                </div>
                <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
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
              {editSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                  {editSuccess}
                </div>
              )}

              <div className="space-y-4">
                {/* CHARACTERS SECTION */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Characters</h3>

                  <div className="relative">
                    <div className="flex flex-wrap gap-2">
                      {/* Current Characters */}
                      {selectedPost.characters?.length > 0 &&
                        selectedPost.characters.map((char, idx) => (
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
                              setCharacterModalSuggestions
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
                              setCharacterModalSuggestions
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
                        {characterModalSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {characterModalSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setNewCharacter(suggestion);
                                  setCharacterModalSuggestions([]);
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
                      {selectedPost.series?.length > 0 &&
                        selectedPost.series.map((s, idx) => (
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
                            handleAdd("series", newSeries, setNewSeries, setSeriesModalSuggestions)
                          }
                          placeholder="Add series..."
                          className="w-40 px-2.5 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                        />
                        <button
                          onClick={() =>
                            handleAdd("series", newSeries, setNewSeries, setSeriesModalSuggestions)
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
                        {seriesModalSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {seriesModalSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setNewSeries(suggestion);
                                  setSeriesModalSuggestions([]);
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
                      {selectedPost.tags?.length > 0 &&
                        selectedPost.tags.map((tag, idx) => (
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
                            e.key === "Enter" &&
                            handleAdd("tags", newTag, setNewTag, setTagModalSuggestions)
                          }
                          placeholder="Add tag..."
                          className="w-40 px-2.5 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                        />
                        <button
                          onClick={() =>
                            handleAdd("tags", newTag, setNewTag, setTagModalSuggestions)
                          }
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
                        {tagModalSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 z-20 w-64 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {tagModalSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setNewTag(suggestion);
                                  setTagModalSuggestions([]);
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
                  onClick={closeEditModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
