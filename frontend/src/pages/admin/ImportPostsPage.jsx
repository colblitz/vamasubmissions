import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import AdminPostCard from "./components/AdminPostCard";
import AdminPostModal from "./components/AdminPostModal";

export default function ImportPostsPage() {
  const { user } = useAuth();
  const [pendingPosts, setPendingPosts] = useState([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [latestPublishedDate, setLatestPublishedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Bulk selection
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Modal state
  const [modalState, setModalState] = useState({ isOpen: false, postIndex: null });

  // Local editing state for each post (characters, series, and tags)
  const [postEdits, setPostEdits] = useState({});

  // Auto-save state
  const [savingPosts, setSavingPosts] = useState({});
  const saveTimers = useRef({});

  // Fetch pending posts
  const fetchPendingPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/admin/posts/pending", {
        params: { limit: 50 },
      });

      // Handle new response structure
      if (response.data.posts) {
        setPendingPosts(response.data.posts);
        setTotalPendingCount(response.data.total || response.data.posts.length);
        setLatestPublishedDate(response.data.latest_published_date);
        
        // Initialize editing state for each post
        const edits = {};
        response.data.posts.forEach(post => {
          edits[post.id] = {
            characters: post.characters || [],
            series: post.series || [],
            tags: post.tags || [],
          };
        });
        setPostEdits(edits);
      } else {
        // Fallback for old response format
        setPendingPosts(response.data);
        setTotalPendingCount(response.data.length);
        
        const edits = {};
        response.data.forEach(post => {
          edits[post.id] = {
            characters: post.characters || [],
            series: post.series || [],
            tags: post.tags || [],
          };
        });
        setPostEdits(edits);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load pending posts");
    } finally {
      setLoading(false);
    }
  };

  // Remove a post from the local list (after publish/delete)
  const removePostFromList = (postId) => {
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
    setTotalPendingCount((prev) => Math.max(0, prev - 1));
    setSelectedPosts((prev) => prev.filter((id) => id !== postId));
    setPostEdits((prev) => {
      const newEdits = { ...prev };
      delete newEdits[postId];
      return newEdits;
    });
  };

  // Auto-save function with debouncing - takes explicit edits to avoid stale state
  const autoSave = async (postId, editsToSave) => {
    setSavingPosts((prev) => ({ ...prev, [postId]: true }));
    
    try {
      console.log(`[AUTO-SAVE] Post ${postId}:`, editsToSave);
      
      await api.patch(`/api/admin/posts/${postId}`, {
        characters: editsToSave.characters,
        series: editsToSave.series,
        tags: editsToSave.tags,
      });

      // Update the post in the list
      setPendingPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, characters: editsToSave.characters, series: editsToSave.series, tags: editsToSave.tags }
            : p
        )
      );
      
      console.log(`[AUTO-SAVE] Success for post ${postId}`);
    } catch (err) {
      console.error("Auto-save failed:", err);
      setError(err.response?.data?.detail || "Failed to auto-save changes");
    } finally {
      setSavingPosts((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Trigger auto-save with debouncing - pass the new edits explicitly
  const triggerAutoSave = (postId, newEdits) => {
    // Clear existing timer for this post
    if (saveTimers.current[postId]) {
      clearTimeout(saveTimers.current[postId]);
    }

    // Set new timer - pass the edits to avoid stale state
    saveTimers.current[postId] = setTimeout(() => {
      autoSave(postId, newEdits);
    }, 500); // 500ms debounce
  };

  // Update both characters and series at once (for auto-fill)
  const updatePostCharactersAndSeries = (postId, characters, series) => {
    const newEdits = {
      ...postEdits[postId],
      characters,
      series,
    };
    setPostEdits((prev) => ({
      ...prev,
      [postId]: newEdits,
    }));
    triggerAutoSave(postId, newEdits);
  };

  // Update characters for a post
  const updatePostCharacters = (postId, characters) => {
    const newEdits = {
      ...postEdits[postId],
      characters,
    };
    setPostEdits((prev) => ({
      ...prev,
      [postId]: newEdits,
    }));
    triggerAutoSave(postId, newEdits);
  };

  // Update series for a post
  const updatePostSeries = (postId, series) => {
    const newEdits = {
      ...postEdits[postId],
      series,
    };
    setPostEdits((prev) => ({
      ...prev,
      [postId]: newEdits,
    }));
    triggerAutoSave(postId, newEdits);
  };

  // Update tags for a post
  const updatePostTags = (postId, tags) => {
    console.log(`[UPDATE-TAGS] Post ${postId}, new tags:`, tags);
    const newEdits = {
      ...postEdits[postId],
      tags,
    };
    console.log(`[UPDATE-TAGS] New edits for post ${postId}:`, newEdits);
    setPostEdits((prev) => ({
      ...prev,
      [postId]: newEdits,
    }));
    triggerAutoSave(postId, newEdits);
  };

  // Save changes for a single post
  const handleSave = async (postId) => {
    setError(null);
    setSuccess(null);

    try {
      const edits = postEdits[postId];
      await api.patch(`/api/admin/posts/${postId}`, {
        characters: edits.characters,
        series: edits.series,
      });

      // Update the post in the list
      setPendingPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, characters: edits.characters, series: edits.series }
            : p
        )
      );

      setSuccess("Changes saved!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save changes");
    }
  };

  // Publish a single post
  const handlePublish = async (postId) => {
    const edits = postEdits[postId];
    
    if (!edits.characters.length || !edits.series.length) {
      setError("Please add at least one character and series before publishing");
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // Save first
      await api.patch(`/api/admin/posts/${postId}`, {
        characters: edits.characters,
        series: edits.series,
      });

      // Then publish
      await api.post(`/api/admin/posts/${postId}/publish`);

      setSuccess("Post published successfully!");
      setTimeout(() => {
        removePostFromList(postId);
        setSuccess(null);
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to publish post");
    }
  };

  // Skip a single post
  const handleSkip = async (postId) => {
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/api/admin/posts/${postId}/skip`);
      setSuccess("Post marked as skipped");
      setTimeout(() => {
        removePostFromList(postId);
        setSuccess(null);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to skip post");
    }
  };

  // Delete a single post
  const handleDelete = async (postId) => {
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/api/admin/posts/${postId}`);
      setSuccess("Post deleted");
      setTimeout(() => {
        removePostFromList(postId);
        setSuccess(null);
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete post");
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
      const response = await api.post(
        "/api/admin/posts/bulk-publish",
        selectedPosts,
      );

      setSuccess(
        `Published ${response.data.published.length} posts, ${response.data.failed.length} failed`,
      );
      setSelectedPosts([]);
      fetchPendingPosts();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to bulk publish");
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) {
      setError("No posts selected");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedPosts.length} posts?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await api.delete("/api/admin/posts/bulk-delete", {
        data: selectedPosts,
      });

      setSuccess(
        `Deleted ${response.data.deleted.length} posts, ${response.data.failed.length} failed`,
      );
      setSelectedPosts([]);
      fetchPendingPosts();
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

  // Select posts that are ready to publish (have both characters AND series)
  const selectReadyToPublish = () => {
    const readyPosts = pendingPosts.filter((post) => {
      const edits = postEdits[post.id];
      return edits && edits.characters.length > 0 && edits.series.length > 0;
    });
    setSelectedPosts(readyPosts.map((p) => p.id));
  };

  // Modal handlers
  const handleOpenModal = (index) => {
    setModalState({ isOpen: true, postIndex: index });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, postIndex: null });
  };

  const handleModalNavigate = (newIndex) => {
    setModalState({ isOpen: true, postIndex: newIndex });
  };

  useEffect(() => {
    fetchPendingPosts();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Pending Posts</h1>
        <p className="text-gray-600">
          Review and manage posts imported via the local import script. Click any card to edit in detail view.
        </p>
        {latestPublishedDate && (
          <p className="text-sm text-gray-500 mt-2">
            Latest published post:{" "}
            {new Date(latestPublishedDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
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

      {/* Pending Posts Count */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-gray-600">
          {pendingPosts.length} of {totalPendingCount} pending post
          {totalPendingCount !== 1 ? "s" : ""} awaiting review
        </div>
        
        {pendingPosts.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={selectReadyToPublish}
              className="text-green-600 hover:text-green-800 font-medium text-sm"
            >
              Select Ready to Publish
            </button>
            <button
              onClick={toggleSelectAll}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedPosts([])}
              className="text-gray-600 hover:text-gray-800 font-medium text-sm"
            >
              Deselect All
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      ) : pendingPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          <p className="text-lg font-medium mb-2">No pending posts</p>
          <p className="text-sm">
            Use the local import script to fetch new posts from Patreon.
          </p>
        </div>
      ) : (
        <>
          {/* Grid Layout - Same as SearchPage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pendingPosts.map((post, index) => (
              <AdminPostCard
                key={post.id}
                post={post}
                isSelected={selectedPosts.includes(post.id)}
                onToggleSelect={() => togglePostSelection(post.id)}
                onPublish={() => handlePublish(post.id)}
                onSkip={() => handleSkip(post.id)}
                onDelete={() => handleDelete(post.id)}
                onClick={() => handleOpenModal(index)}
                characters={postEdits[post.id]?.characters || []}
                series={postEdits[post.id]?.series || []}
                tags={postEdits[post.id]?.tags || []}
                isSaving={savingPosts[post.id] || false}
              />
            ))}
          </div>

          {/* Bulk Actions Bar - Sticky at bottom when items selected */}
          {selectedPosts.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-500 shadow-lg z-40">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-gray-900">
                      {selectedPosts.length} post{selectedPosts.length !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      onClick={() => setSelectedPosts([])}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleBulkPublish}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Publish ({selectedPosts.length})
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedPosts.length === 0) return;
                        for (const postId of selectedPosts) {
                          await handleSkip(postId);
                        }
                        setSelectedPosts([]);
                      }}
                      className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                    >
                      Skip ({selectedPosts.length})
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Delete ({selectedPosts.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin Post Modal */}
      {modalState.isOpen && modalState.postIndex !== null && (
        <AdminPostModal
          post={pendingPosts[modalState.postIndex]}
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          onPrevious={modalState.postIndex > 0 ? () => handleModalNavigate(modalState.postIndex - 1) : null}
          onNext={modalState.postIndex < pendingPosts.length - 1 ? () => handleModalNavigate(modalState.postIndex + 1) : null}
          onRemove={removePostFromList}
          currentIndex={modalState.postIndex}
          totalPosts={pendingPosts.length}
          characters={postEdits[pendingPosts[modalState.postIndex].id]?.characters || []}
          series={postEdits[pendingPosts[modalState.postIndex].id]?.series || []}
          tags={postEdits[pendingPosts[modalState.postIndex].id]?.tags || []}
          onCharactersChange={(chars) => updatePostCharacters(pendingPosts[modalState.postIndex].id, chars)}
          onSeriesChange={(ser) => updatePostSeries(pendingPosts[modalState.postIndex].id, ser)}
          onCharactersAndSeriesChange={(chars, ser) => updatePostCharactersAndSeries(pendingPosts[modalState.postIndex].id, chars, ser)}
          onTagsChange={(tags) => updatePostTags(pendingPosts[modalState.postIndex].id, tags)}
          isSaving={savingPosts[pendingPosts[modalState.postIndex].id] || false}
        />
      )}
    </div>
  );
}
