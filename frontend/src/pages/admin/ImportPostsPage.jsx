import { useState, useEffect } from "react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import FetchNewPostsForm from "./components/FetchNewPostsForm";
import BulkActionsBar from "./components/BulkActionsBar";
import PendingPostCard from "./components/PendingPostCard";

export default function ImportPostsPage() {
  const { user } = useAuth();
  const [pendingPosts, setPendingPosts] = useState([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [latestPublishedDate, setLatestPublishedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Session ID for fetching
  const [sessionIdInput, setSessionIdInput] = useState("");

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

      // Handle new response structure
      if (response.data.posts) {
        setPendingPosts(response.data.posts);
        setTotalPendingCount(response.data.total || response.data.posts.length);
        setLatestPublishedDate(response.data.latest_published_date);
      } else {
        // Fallback for old response format
        setPendingPosts(response.data);
        setTotalPendingCount(response.data.length);
      }
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
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
    setTotalPendingCount((prev) => Math.max(0, prev - 1));
    setSelectedPosts((prev) => prev.filter((id) => id !== postId));
  };

  // Fetch new posts from Patreon
  const handleFetchNew = async () => {
    // Validate session_id is provided
    if (!sessionIdInput.trim()) {
      setError(
        "Please enter your Patreon session_id cookie to fetch new posts",
      );
      return;
    }

    setFetching(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post("/api/admin/posts/fetch-new", {
        since_days: 7,
        session_id: sessionIdInput.trim(),
      });

      setSuccess(
        `Imported ${response.data.imported} new posts, ${response.data.skipped} already existed`,
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
      const response = await api.post(
        "/api/admin/posts/bulk-publish",
        selectedPosts,
      );

      setSuccess(
        `Published ${response.data.published.length} posts, ${response.data.failed.length} failed`,
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
          const post = pendingPosts.find((p) => p.id === postId);
          if (
            post &&
            (post.characters?.length > 0 || post.series?.length > 0)
          ) {
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

      setSuccess(
        `Saved ${savedCount} posts${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      );
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

      setSuccess(
        `Deleted ${response.data.deleted.length} posts, ${response.data.failed.length} failed`,
      );
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Import Posts</h1>

        <FetchNewPostsForm
          sessionIdInput={sessionIdInput}
          setSessionIdInput={setSessionIdInput}
          fetching={fetching}
          latestPublishedDate={latestPublishedDate}
          onFetchNew={handleFetchNew}
        />
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
        <BulkActionsBar
          selectedCount={selectedPosts.length}
          totalCount={pendingPosts.length}
          onSelectAll={toggleSelectAll}
          onBulkSave={handleBulkSave}
          onBulkPublish={handleBulkPublish}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Pending Posts Count */}
      <div className="mb-4 text-gray-600">
        {pendingPosts.length} of {totalPendingCount} pending post
        {totalPendingCount !== 1 ? "s" : ""} awaiting review
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
