import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function ImportPostsPage() {
  const { user } = useAuth();
  const [pendingPosts, setPendingPosts] = useState([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Bulk selection
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Fetch pending posts
  const fetchPendingPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/admin/posts/pending", {
        params: { limit: 50 },
      });
      setPendingPosts(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load pending posts");
    } finally {
      setLoading(false);
    }
  };

  // Fetch total pending count
  const fetchTotalCount = async () => {
    try {
      const response = await api.get("/api/admin/posts/pending", {
        params: { limit: 1000 },
      });
      setTotalPendingCount(response.data.length);
    } catch (err) {
      console.error("Failed to fetch total count:", err);
    }
  };

  // Remove a post from the local list (after publish/delete)
  const removePostFromList = (postId) => {
    setPendingPosts(prev => prev.filter(p => p.id !== postId));
    setTotalPendingCount(prev => Math.max(0, prev - 1));
    setSelectedPosts(prev => prev.filter(id => id !== postId));
  };

  // Fetch new posts from Patreon
  const handleFetchNew = async () => {
    setFetching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post("/api/admin/posts/fetch-new", {
        since_days: 7,
      });

      setSuccess(
        `Imported ${response.data.imported} new posts, ${response.data.skipped} already existed`
      );
      fetchPendingPosts(); // Refresh list
      fetchTotalCount();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch new posts");
    } finally {
      setFetching(false);
    }
  };

  // Bulk publish
  const handleBulkPublish = async () => {
    if (selectedPosts.length === 0) {
      setError("No posts selected");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await api.post("/api/admin/posts/bulk-publish", selectedPosts);

      setSuccess(
        `Published ${response.data.published.length} posts, ${response.data.failed.length} failed`
      );
      setSelectedPosts([]);
      fetchPendingPosts();
      fetchTotalCount();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to bulk publish");
    }
  };

  // Bulk save
  const handleBulkSave = async () => {
    if (selectedPosts.length === 0) {
      setError("No posts selected");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // Get all selected post cards and save them
      let savedCount = 0;
      let failedCount = 0;

      for (const postId of selectedPosts) {
        try {
          // Find the post in pendingPosts
          const post = pendingPosts.find(p => p.id === postId);
          if (post && (post.characters?.length > 0 || post.series?.length > 0)) {
            await api.patch(`/api/admin/posts/${postId}`, {
              characters: post.characters || [],
              series: post.series || [],
            });
            savedCount++;
          }
        } catch (err) {
          console.error(`Failed to save post ${postId}:`, err);
          failedCount++;
        }
      }

      setSuccess(`Saved ${savedCount} posts${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
      fetchPendingPosts(); // Refresh to clear unsaved indicators
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to bulk save");
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) {
      setError("No posts selected");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await api.delete("/api/admin/posts/bulk-delete", {
        data: selectedPosts,
      });

      setSuccess(`Deleted ${response.data.deleted.length} posts, ${response.data.failed.length} failed`);
      setSelectedPosts([]);
      fetchPendingPosts();
      fetchTotalCount();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to bulk delete");
    }
  };

  // Toggle post selection
  const togglePostSelection = (postId) => {
    setSelectedPosts((prev) => {
      if (prev.includes(postId)) {
        return prev.filter((id) => id !== postId);
      } else {
        return [...prev, postId];
      }
    });
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedPosts.length === pendingPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(pendingPosts.map((p) => p.id));
    }
  };

  useEffect(() => {
    fetchPendingPosts();
    fetchTotalCount();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Import Posts</h1>

        <button
          onClick={handleFetchNew}
          disabled={fetching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {fetching ? "Fetching..." : "Fetch New Posts from Patreon"}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Bulk Actions */}
      {pendingPosts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPosts.length === pendingPosts.length && pendingPosts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedPosts.length} selected)
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBulkSave}
                disabled={selectedPosts.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Selected ({selectedPosts.length})
              </button>

              <button
                onClick={handleBulkPublish}
                disabled={selectedPosts.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Publish Selected ({selectedPosts.length})
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={selectedPosts.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Selected ({selectedPosts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Posts Count */}
      <div className="mb-4 text-gray-600">
        {pendingPosts.length} of {totalPendingCount} pending post{totalPendingCount !== 1 ? "s" : ""} awaiting review
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      ) : pendingPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          No pending posts. Click "Fetch New Posts" to import from Patreon.
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map((post) => (
            <PendingPostCard
              key={post.id}
              post={post}
              isSelected={selectedPosts.includes(post.id)}
              onToggleSelect={() => togglePostSelection(post.id)}
              onRemove={removePostFromList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingPostCard({ post, isSelected, onToggleSelect, onRemove }) {
  const [characters, setCharacters] = useState(post.characters || []);
  const [series, setSeries] = useState(post.series || []);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [cardSuccess, setCardSuccess] = useState(null);

  // Track unsaved changes
  const hasUnsavedChanges = 
    JSON.stringify(characters.sort()) !== JSON.stringify((post.characters || []).sort()) ||
    JSON.stringify(series.sort()) !== JSON.stringify((post.series || []).sort());

  // Auto-fill from title
  const handleAutoFill = () => {
    const title = post.title;
    
    // Pattern 1: "Character Name (Series)" or "Character Name (Series) 500 pics"
    // Examples: "Hasuma Kanae (Tsumamigui)", "lucrezia noin (gundam) 500 pics"
    const pattern1 = /^([^(]+)\s*\(([^)]+)\)/i;
    const match1 = title.match(pattern1);
    
    if (match1) {
      const extractedChar = match1[1].trim();
      const extractedSeries = match1[2].trim();
      
      // Title case the names
      const titleCaseChar = extractedChar
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      const titleCaseSeries = extractedSeries
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      // Add character if not already present
      if (!characters.includes(titleCaseChar)) {
        setCharacters([...characters, titleCaseChar]);
      }
      
      // Add series if not already present
      if (!series.includes(titleCaseSeries)) {
        setSeries([...series, titleCaseSeries]);
      }
      
      setCardSuccess("Auto-filled character and series from title!");
      setTimeout(() => setCardSuccess(null), 3000);
      return;
    }
    
    // If no pattern matched, show a message
    setCardError("Could not auto-fill: title format not recognized. Expected format: 'Character Name (Series)'");
    setTimeout(() => setCardError(null), 3000);
  };

  // Character autocomplete
  const [characterInput, setCharacterInput] = useState("");
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [characterSeriesMap, setCharacterSeriesMap] = useState({});

  // Series autocomplete
  const [seriesInput, setSeriesInput] = useState("");
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);

  // Refs for click-away detection
  const characterRef = useRef(null);
  const seriesRef = useRef(null);

  // Fetch character suggestions with series
  const fetchCharacterSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setCharacterSuggestions([]);
      setCharacterSeriesMap({});
      return;
    }

    try {
      const response = await api.get("/api/posts/autocomplete/characters-with-series", {
        params: { q: query, limit: 10 },
      });
      
      // Backend returns array of {character, series} objects
      const data = response.data || [];
      
      // Convert to map: {character: series}
      const charSeriesMap = {};
      const charNames = [];
      
      data.forEach(item => {
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
      if (characterRef.current && !characterRef.current.contains(event.target)) {
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

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setCardError(null);
    setCardSuccess(null);

    try {
      await api.patch(`/api/admin/posts/${post.id}`, {
        characters,
        series,
      });

      // Update the post object to reflect saved changes
      post.characters = [...characters];
      post.series = [...series];

      setCardSuccess("Changes saved!");
      setTimeout(() => setCardSuccess(null), 3000);
    } catch (err) {
      setCardError(err.response?.data?.detail || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Publish post
  const handlePublish = async () => {
    if (!characters.length || !series.length) {
      setCardError("Please add at least one character and series before publishing");
      return;
    }

    setPublishing(true);
    setCardError(null);
    setCardSuccess(null);

    try {
      // Save first
      await api.patch(`/api/admin/posts/${post.id}`, {
        characters,
        series,
      });

      // Then publish
      await api.post(`/api/admin/posts/${post.id}/publish`);

      setCardSuccess("Post published successfully!");
      // Remove this post from the list after a brief delay
      setTimeout(() => {
        onRemove(post.id);
      }, 1000);
    } catch (err) {
      setCardError(err.response?.data?.detail || "Failed to publish post");
    } finally {
      setPublishing(false);
    }
  };

  // Skip post (for non-character posts like announcements)
  const handleSkip = async () => {
    setCardError(null);
    setCardSuccess(null);

    try {
      await api.post(`/api/admin/posts/${post.id}/skip`);
      setCardSuccess("Post marked as skipped (won't appear in search, won't be re-imported)");
      setTimeout(() => {
        onRemove(post.id);
      }, 1500);
    } catch (err) {
      setCardError(err.response?.data?.detail || "Failed to skip post");
    }
  };

  // Delete post
  const handleDelete = async () => {
    setCardError(null);
    setCardSuccess(null);

    try {
      await api.delete(`/api/admin/posts/${post.id}`);
      setCardSuccess("Post deleted");
      setTimeout(() => {
        onRemove(post.id);
      }, 1000);
    } catch (err) {
      setCardError(err.response?.data?.detail || "Failed to delete post");
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
      {/* Card-level success/error banners */}
      {cardSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded mb-4 text-sm">
          {cardSuccess}
        </div>
      )}
      {cardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {cardError}
        </div>
      )}
      <div className="flex gap-6">
        {/* Checkbox */}
        <div className="flex items-start pt-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 cursor-pointer"
          />
        </div>

        {/* Thumbnail */}
        {post.thumbnail_urls?.[0] ? (
          <img
            src={post.thumbnail_urls[0]}
            alt={post.title}
            className="w-48 h-48 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div className="w-48 h-48 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400">No preview</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Unsaved changes
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500 mb-4">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Patreon
            </a>
            <span className="mx-2">•</span>
            <span>{new Date(post.timestamp).toLocaleDateString()}</span>
          </div>

          {/* Characters Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Characters *</label>
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
                        setCharacters([...characters, characterInput.trim()]);
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
                    if (characterInput.trim() && !characters.includes(characterInput.trim())) {
                      setCharacters([...characters, characterInput.trim()]);
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
                        // Add character if not already added
                        if (!characters.includes(suggestion)) {
                          setCharacters([...characters, suggestion]);
                        }
                        
                        // Auto-add series if character has one and series not already added
                        const associatedSeries = characterSeriesMap[suggestion];
                        if (associatedSeries && !series.includes(associatedSeries)) {
                          setSeries([...series, associatedSeries]);
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
                    onClick={() => setCharacters(characters.filter((_, i) => i !== idx))}
                    className="hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Series Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Series *</label>
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
                        setSeries([...series, seriesInput.trim()]);
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
                    if (seriesInput.trim() && !series.includes(seriesInput.trim())) {
                      setSeries([...series, seriesInput.trim()]);
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
                          setSeries([...series, suggestion]);
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
                    onClick={() => setSeries(series.filter((_, i) => i !== idx))}
                    className="hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAutoFill}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              title="Auto-fill character and series from title"
            >
              Auto-fill
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={handlePublish}
              disabled={publishing || !characters.length || !series.length}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>

            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 ml-auto"
              title="Mark as non-character post (announcement, etc.) - won't appear in search or be re-imported"
            >
              Skip
            </button>

            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
