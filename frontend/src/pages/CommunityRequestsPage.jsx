import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function CommunityRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    characters: "",
    series: "",
    description: "",
    timestamp: "", // Date when user wants this fulfilled
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Store request ID to delete

  // Autocomplete state
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [showCharacterSuggestions, setShowCharacterSuggestions] = useState(false);
  const [showSeriesSuggestions, setShowSeriesSuggestions] = useState(false);

  // Fetch community queue
  const fetchQueue = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/requests/", {
        params: { status: "pending", limit: 50 },
      });
      setRequests(response.data.requests);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  // Fetch my requests
  const fetchMyRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/requests/my");
      // Backend returns plain array, not {requests: [...]}
      setMyRequests(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load your requests");
    } finally {
      setLoading(false);
    }
  };

  // Autocomplete for characters
  const fetchCharacterSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setCharacterSuggestions([]);
      return;
    }

    try {
      const response = await api.get("/api/posts/autocomplete/characters", {
        params: { q: query, limit: 10 },
      });
      setCharacterSuggestions(response.data || []);
    } catch (err) {
      console.error("Failed to fetch character suggestions:", err);
    }
  };

  // Autocomplete for series
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

  // Handle character input change
  const handleCharacterInputChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, characters: value });

    // Get the last item being typed (after the last comma)
    const items = value.split(",");
    const lastItem = items[items.length - 1].trim();

    if (lastItem.length >= 2) {
      fetchCharacterSuggestions(lastItem);
      setShowCharacterSuggestions(true);
    } else {
      setShowCharacterSuggestions(false);
    }
  };

  // Handle series input change
  const handleSeriesInputChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, series: value });

    // Get the last item being typed (after the last comma)
    const items = value.split(",");
    const lastItem = items[items.length - 1].trim();

    if (lastItem.length >= 2) {
      fetchSeriesSuggestions(lastItem);
      setShowSeriesSuggestions(true);
    } else {
      setShowSeriesSuggestions(false);
    }
  };

  // Add character from autocomplete
  const addCharacterSuggestion = (suggestion) => {
    const items = formData.characters
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lastItem = items.pop() || "";

    // Replace the last item with the suggestion
    items.push(suggestion);
    setFormData({ ...formData, characters: items.join(", ") + ", " });
    setShowCharacterSuggestions(false);
  };

  // Add series from autocomplete
  const addSeriesSuggestion = (suggestion) => {
    const items = formData.series
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lastItem = items.pop() || "";

    // Replace the last item with the suggestion
    items.push(suggestion);
    setFormData({ ...formData, series: items.join(", ") + ", " });
    setShowSeriesSuggestions(false);
  };

  // Submit new request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitSuccess(false);

    try {
      // Convert date string to ISO datetime
      const timestamp = formData.timestamp
        ? new Date(formData.timestamp).toISOString()
        : new Date().toISOString();

      await api.post("/api/requests/", {
        characters: formData.characters
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        series: formData.series
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        description: formData.description,
        timestamp: timestamp,
      });

      setFormData({ characters: "", series: "", description: "", timestamp: "" });
      setSubmitSuccess(true);
      setShowForm(false);

      // Refresh both lists
      fetchMyRequests();
      fetchQueue();

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit request");
    }
  };

  // Delete request - show confirmation first
  const handleDeleteClick = (requestId) => {
    setDeleteConfirm(requestId);
    setDeleteError("");
    setDeleteSuccess(false);
  };

  // Confirm delete
  const confirmDelete = async () => {
    const requestId = deleteConfirm;
    setDeleteConfirm(null);
    setDeleteError("");
    setDeleteSuccess(false);

    try {
      await api.delete(`/api/requests/${requestId}`);
      fetchMyRequests();
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      setDeleteError(err.response?.data?.detail || "Failed to delete request");
      setTimeout(() => setDeleteError(""), 5000);
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  useEffect(() => {
    fetchQueue();
    fetchMyRequests();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Community Requests</h1>

      {/* Disclaimer Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Important Notice</h3>
            <p className="text-sm text-blue-800">
              This is an <strong>unofficial community tracker</strong> for character requests. Not all users record their requests here, 
              so the queue may not reflect the complete picture. This tool is meant to help the community coordinate and track 
              what has been requested, but it is not managed or endorsed by VAMA.
            </p>
          </div>
        </div>
      </div>

      {/* Success Messages */}
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          Request submitted successfully!
        </div>
      )}

      {deleteSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          Request deleted successfully!
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {deleteError}
        </div>
      )}

      {/* New Request Form - Collapsible */}
      <div className="bg-white rounded-lg shadow mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50"
        >
          <span className="text-xl font-semibold text-gray-900">
            {showForm ? "▼" : "▶"} Record a Request
          </span>
        </button>

        {showForm && (
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Characters (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.characters}
                  onChange={handleCharacterInputChange}
                  onFocus={() => formData.characters && setShowCharacterSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCharacterSuggestions(false), 200)}
                  placeholder="e.g., Kafka, Himeko"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                  required
                />
                {showCharacterSuggestions && characterSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {characterSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addCharacterSuggestion(suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Series (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.series}
                  onChange={handleSeriesInputChange}
                  onFocus={() => formData.series && setShowSeriesSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSeriesSuggestions(false), 200)}
                  placeholder="e.g., Honkai: Star Rail"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                  required
                />
                {showSeriesSuggestions && seriesSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {seriesSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addSeriesSuggestion(suggestion)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requested Date
                </label>
                <input
                  type="date"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  When did you submit this request to VAMA?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Any additional details..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Record Request
              </button>
            </form>
          </div>
        )}
      </div>

      {/* My Requests Section */}
      {myRequests && myRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">My Requests</h2>
          <div className="space-y-3">
            {myRequests.map((request) => {
              // Calculate queue position (1-indexed)
              const queuePosition = requests.findIndex(r => r.id === request.id) + 1;
              
              return (
                <div key={request.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {request.characters.join(", ")}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            request.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : request.status === "fulfilled"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {request.status}
                        </span>
                        {request.status === "pending" && queuePosition > 0 && (
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            #{queuePosition} in queue
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm mb-1">
                        Series: {request.series.join(", ")}
                      </p>

                      {request.description && (
                        <p className="text-gray-700 text-sm mb-1">{request.description}</p>
                      )}

                      <p className="text-xs text-gray-500">
                        Requested on:{" "}
                        {request.timestamp
                          ? new Date(request.timestamp).toLocaleDateString()
                          : "Not specified"}
                      </p>

                      {request.fulfilled_post_id && (
                        <a
                          href={`https://www.patreon.com/posts/${request.fulfilled_post_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                        >
                          View fulfilled post →
                        </a>
                      )}
                    </div>

                    {request.status === "pending" && (
                      <button
                        onClick={() => handleDeleteClick(request.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Known Queue Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Known Queue</h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No pending requests in the queue
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {request.characters.join(", ")}
                </h3>

                <p className="text-gray-600 text-sm mb-1">Series: {request.series.join(", ")}</p>

                {request.description && (
                  <p className="text-gray-700 text-sm mb-1">{request.description}</p>
                )}

                <p className="text-xs text-gray-500">
                  Requested on:{" "}
                  {request.timestamp
                    ? new Date(request.timestamp).toLocaleDateString()
                    : "Not specified"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Banner */}
      {deleteConfirm && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
          <p className="text-gray-900 font-medium mb-3">
            Are you sure you want to delete this request?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={cancelDelete}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
