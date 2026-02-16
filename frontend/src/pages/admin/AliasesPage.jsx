import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

export default function AliasesPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("characters");

  // UI state
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Data state
  const [, setAliases] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [groupedAliases, setGroupedAliases] = useState({});

  // Form state
  const [canonicalValue, setCanonicalValue] = useState("");
  const [aliasValue, setAliasValue] = useState("");
  const [canonicalSuggestions, setCanonicalSuggestions] = useState([]);
  const [showCanonicalDropdown, setShowCanonicalDropdown] = useState(false);

  // Edit state
  const [editingAlias, setEditingAlias] = useState(null);

  // Confirmation state
  const [confirmingDelete, setConfirmingDelete] = useState(null); // {type: 'alias'|'suggestion', id: aliasId|searchTerm}

  // Loading and feedback state
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Fetch aliases for the current tab
  const fetchAliases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/aliases/", {
        params: { field_type: activeTab },
      });

      const aliasesList = response.data.aliases || [];
      setAliases(aliasesList);

      // Group aliases by canonical value
      const grouped = {};
      aliasesList.forEach((alias) => {
        if (!grouped[alias.canonical_value]) {
          grouped[alias.canonical_value] = [];
        }
        grouped[alias.canonical_value].push(alias);
      });
      setGroupedAliases(grouped);
    } catch (err) {
      console.error("Failed to load aliases:", err);
      setError(err.response?.data?.detail || "Failed to load aliases");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch zero-result suggestions
  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);

    try {
      const response = await api.get("/api/aliases/suggestions", {
        params: { field_type: activeTab },
      });

      setSuggestions(response.data.suggestions || []);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [activeTab]);

  // Fetch canonical value suggestions for autocomplete
  const fetchCanonicalSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setCanonicalSuggestions([]);
      return;
    }

    try {
      let endpoint = "";
      if (activeTab === "characters") {
        endpoint = "/api/posts/autocomplete/characters";
      } else if (activeTab === "series") {
        endpoint = "/api/posts/autocomplete/series";
      } else if (activeTab === "tags") {
        endpoint = "/api/posts/autocomplete/tags";
      }

      const response = await api.get(endpoint, {
        params: { q: query, limit: 10 },
      });

      setCanonicalSuggestions(response.data || []);
      setShowCanonicalDropdown(true);
    } catch (err) {
      console.error("Failed to fetch canonical suggestions:", err);
    }
  };

  // Create a new alias
  const handleCreateAlias = async (e) => {
    e.preventDefault();

    if (!canonicalValue.trim() || !aliasValue.trim()) {
      setError("Both canonical value and alias are required");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.post("/api/aliases/", {
        field_type: activeTab,
        canonical_value: canonicalValue.trim(),
        alias_value: aliasValue.trim(),
      });

      setSuccess("Alias created successfully!");
      setCanonicalValue("");
      setAliasValue("");
      fetchAliases();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to create alias:", err);

      // Extract error message properly
      let errorMessage = "Failed to create alias";
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === "string") {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          // FastAPI validation errors are arrays
          errorMessage = err.response.data.detail.map((e) => e.msg).join(", ");
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  // Create alias from suggestion
  const handleCreateFromSuggestion = async (searchTerm) => {
    setCanonicalValue("");
    setAliasValue(searchTerm);
    setShowSuggestions(false);

    // Scroll to the add form
    setTimeout(() => {
      document
        .getElementById("add-alias-form")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Delete a search suggestion - first click shows confirmation
  const handleDeleteSuggestionClick = (searchTerm) => {
    setConfirmingDelete({ type: "suggestion", id: searchTerm });
  };

  // Confirm delete suggestion
  const confirmDeleteSuggestion = async () => {
    const searchTerm = confirmingDelete.id;
    setConfirmingDelete(null);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(
        `/api/aliases/suggestions/${activeTab}/${encodeURIComponent(searchTerm)}`,
      );

      setSuccess("Search suggestion deleted successfully!");
      fetchSuggestions(); // Refresh the list

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete suggestion");
    }
  };

  // Delete an alias - first click shows confirmation
  const handleDeleteAliasClick = (aliasId) => {
    setConfirmingDelete({ type: "alias", id: aliasId });
  };

  // Confirm delete alias
  const confirmDeleteAlias = async () => {
    const aliasId = confirmingDelete.id;
    setConfirmingDelete(null);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/api/aliases/${aliasId}`);

      setSuccess("Alias deleted successfully!");
      fetchAliases();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete alias");
    }
  };

  // Cancel delete confirmation
  const cancelDelete = () => {
    setConfirmingDelete(null);
  };

  // Update an alias
  const handleUpdateAlias = async (aliasId, newAliasValue) => {
    if (!newAliasValue.trim()) {
      setError("Alias value cannot be empty");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/api/aliases/${aliasId}`, {
        alias_value: newAliasValue.trim(),
      });

      setSuccess("Alias updated successfully!");
      setEditingAlias(null);
      fetchAliases();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update alias");
    }
  };

  // Load aliases when tab changes
  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  // Load suggestions when suggestions section is opened
  useEffect(() => {
    if (showSuggestions) {
      fetchSuggestions();
    }
  }, [showSuggestions, fetchSuggestions]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Manage Aliases
        </h1>
        <p className="text-gray-600">
          Create and manage aliases for characters, series, and tags to improve
          search accuracy
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Main Section: Tabs + Add Form + Existing Aliases */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("characters")}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === "characters"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Characters
          </button>
          <button
            onClick={() => setActiveTab("series")}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === "series"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Series
          </button>
          <button
            onClick={() => setActiveTab("tags")}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === "tags"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Tags
          </button>
        </div>

        {/* Add New Alias Form */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Add New Alias
          </h2>
          <form
            id="add-alias-form"
            onSubmit={handleCreateAlias}
            className="space-y-4 p-4 bg-gray-50 rounded-lg"
          >
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canonical Value
              </label>
              <input
                type="text"
                value={canonicalValue}
                onChange={(e) => {
                  setCanonicalValue(e.target.value);
                  fetchCanonicalSuggestions(e.target.value);
                }}
                onFocus={() => {
                  if (canonicalSuggestions.length > 0) {
                    setShowCanonicalDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Delay to allow clicking on suggestions
                  setTimeout(() => setShowCanonicalDropdown(false), 200);
                }}
                placeholder={`Enter canonical ${activeTab} name`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />

              {/* Autocomplete Dropdown */}
              {showCanonicalDropdown && canonicalSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {canonicalSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setCanonicalValue(suggestion);
                        setShowCanonicalDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-900 hover:bg-blue-50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alias
              </label>
              <input
                type="text"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                placeholder="Enter alias or alternate spelling"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Add Alias
            </button>
          </form>
        </div>

        {/* Existing Aliases */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Existing Aliases
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading aliases...</p>
            </div>
          ) : Object.keys(groupedAliases).length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No aliases found for this category
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                    Canonical Value
                  </th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                    Aliases
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedAliases).flatMap(
                  ([canonical, aliasList]) =>
                    aliasList.map((alias) => (
                      <tr
                        key={alias.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 px-4 font-medium text-gray-900">
                          {canonical}
                        </td>
                        <td className="py-2 px-4">
                          {editingAlias === alias.id ? (
                            <input
                              type="text"
                              defaultValue={alias.alias_value}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateAlias(alias.id, e.target.value);
                                } else if (e.key === "Escape") {
                                  setEditingAlias(null);
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value !== alias.alias_value) {
                                  handleUpdateAlias(alias.id, e.target.value);
                                } else {
                                  setEditingAlias(null);
                                }
                              }}
                              autoFocus
                              className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            />
                          ) : (
                            <span className="text-gray-700">
                              {alias.alias_value}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {editingAlias === alias.id ? (
                            <button
                              onClick={() => setEditingAlias(null)}
                              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          ) : confirmingDelete?.type === "alias" &&
                            confirmingDelete?.id === alias.id ? (
                            <span className="inline-flex gap-2">
                              <button
                                onClick={confirmDeleteAlias}
                                className="px-2 py-1 bg-red-700 text-white rounded hover:bg-red-800 text-sm font-medium"
                              >
                                ✓ Confirm
                              </button>
                              <button
                                onClick={cancelDelete}
                                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex gap-2">
                              <button
                                onClick={() => setEditingAlias(alias.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAliasClick(alias.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                Delete
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Zero-Result Suggestions */}
      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-xl font-bold text-gray-900">
            Zero-Result Suggestions
          </h2>
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform ${
              showSuggestions ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showSuggestions && (
          <div className="mt-4">
            {suggestionsLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading suggestions...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No zero-result searches found
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Search Term
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Times Searched
                    </th>
                    <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">
                      Last Searched
                    </th>
                    <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((suggestion, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-4 font-medium text-gray-900">
                        {suggestion.search_term}
                      </td>
                      <td className="py-2 px-4 text-gray-700">
                        {suggestion.search_count}
                      </td>
                      <td className="py-2 px-4 text-gray-700">
                        {new Date(
                          suggestion.last_searched,
                        ).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {confirmingDelete?.type === "suggestion" &&
                        confirmingDelete?.id === suggestion.search_term ? (
                          <span className="inline-flex gap-2">
                            <button
                              onClick={confirmDeleteSuggestion}
                              className="px-2 py-1 bg-red-700 text-white rounded hover:bg-red-800 text-sm font-medium"
                            >
                              ✓ Confirm Delete
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-2">
                            <button
                              onClick={() =>
                                handleDeleteSuggestionClick(
                                  suggestion.search_term,
                                )
                              }
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() =>
                                handleCreateFromSuggestion(
                                  suggestion.search_term,
                                )
                              }
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                            >
                              Create Alias
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
