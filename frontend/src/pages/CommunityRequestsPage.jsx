import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { siteContent } from "../content/siteContent";

export default function CommunityRequestsPage() {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState([]);
  const [queuePositions, setQueuePositions] = useState({}); // Map of request_id -> position
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    characters: "",
    series: "",
    description: "",
    requested_timestamp: "", // Date when user submitted this to VAMA
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Store request ID to delete

  // Autocomplete state
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [showCharacterSuggestions, setShowCharacterSuggestions] =
    useState(false);
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

  // Fetch my requests and calculate queue positions
  const fetchMyRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch my requests
      const myResponse = await api.get("/api/requests/my");
      const myReqs = myResponse.data || [];
      setMyRequests(myReqs);

      // Fetch all pending requests to calculate queue positions
      const allResponse = await api.get("/api/requests/");
      const allRequests = allResponse.data.requests || [];

      // Sort all requests by requested_timestamp (oldest first)
      const sortedRequests = allRequests.sort(
        (a, b) => new Date(a.requested_timestamp) - new Date(b.requested_timestamp)
      );

      // Calculate position for each of my requests
      const positions = {};
      myReqs.forEach((myReq) => {
        if (myReq.status === "pending" || !myReq.fulfilled) {
          // Count how many requests are before this one
          const position = sortedRequests.findIndex((r) => r.id === myReq.id);
          if (position >= 0) {
            positions[myReq.id] = position; // 0-indexed, so position 0 means "first in queue"
          }
        }
      });

      setQueuePositions(positions);
    } catch (err) {
      console.error("Failed to load requests:", err);
      
      // Extract error message properly
      let errorMessage = "Failed to load your requests";
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          // FastAPI validation errors are arrays
          errorMessage = err.response.data.detail.map(e => e.msg).join(', ');
        } else {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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
      const requested_timestamp = formData.requested_timestamp
        ? new Date(formData.requested_timestamp).toISOString()
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
        requested_timestamp: requested_timestamp,
        is_private: false, // Always false now
      });

      setFormData({
        characters: "",
        series: "",
        description: "",
        requested_timestamp: "",
      });
      setSubmitSuccess(true);
      setShowForm(false);

      // Refresh my requests
      fetchMyRequests();

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit request");
    }
  };

  // Mark request as done - show confirmation first
  const handleMarkDoneClick = (requestId) => {
    setDeleteConfirm(requestId);
    setDeleteError("");
    setDeleteSuccess(false);
  };

  // Confirm mark as done
  const confirmMarkDone = async () => {
    const requestId = deleteConfirm;
    setDeleteConfirm(null);
    setDeleteError("");
    setDeleteSuccess(false);

    try {
      await api.patch(`/api/requests/${requestId}/fulfill`);
      fetchMyRequests();
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      setDeleteError(
        err.response?.data?.detail || "Failed to mark request as done",
      );
      setTimeout(() => setDeleteError(""), 5000);
    }
  };

  // Cancel mark as done
  const cancelMarkDone = () => {
    setDeleteConfirm(null);
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        {siteContent.communityRequests.heading}
      </h1>

      {/* Disclaimer Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              {siteContent.communityRequests.disclaimer.heading}
            </h3>
            <p className="text-sm text-blue-800">
              {siteContent.communityRequests.disclaimer.text}
            </p>
          </div>
        </div>
      </div>

      {/* Success Messages */}
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {siteContent.communityRequests.successMessages.requestSubmitted}
        </div>
      )}

      {deleteSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {siteContent.communityRequests.successMessages.requestMarkedDone}
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
          className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50 min-h-[44px]"
        >
          <span className="text-xl font-semibold text-gray-900">
            {showForm ? "▼" : "▶"} {siteContent.communityRequests.newRequestForm.heading}
          </span>
        </button>

        {showForm && (
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {siteContent.communityRequests.newRequestForm.fields.characters.label}
                </label>
                <input
                  type="text"
                  value={formData.characters}
                  onChange={handleCharacterInputChange}
                  onFocus={() =>
                    formData.characters && setShowCharacterSuggestions(true)
                  }
                  onBlur={() =>
                    setTimeout(() => setShowCharacterSuggestions(false), 200)
                  }
                  placeholder={siteContent.communityRequests.newRequestForm.fields.characters.placeholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-600 min-h-[44px]"
                  required
                />
                {showCharacterSuggestions &&
                  characterSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {characterSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addCharacterSuggestion(suggestion)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 text-gray-900 min-h-[44px]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {siteContent.communityRequests.newRequestForm.fields.series.label}
                </label>
                <input
                  type="text"
                  value={formData.series}
                  onChange={handleSeriesInputChange}
                  onFocus={() =>
                    formData.series && setShowSeriesSuggestions(true)
                  }
                  onBlur={() =>
                    setTimeout(() => setShowSeriesSuggestions(false), 200)
                  }
                  placeholder={siteContent.communityRequests.newRequestForm.fields.series.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-600"
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
                  {siteContent.communityRequests.newRequestForm.fields.requestedDate.label}
                </label>
                <input
                  type="date"
                  value={formData.requested_timestamp}
                  onChange={(e) =>
                    setFormData({ ...formData, requested_timestamp: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {siteContent.communityRequests.newRequestForm.fields.requestedDate.helpText}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {siteContent.communityRequests.newRequestForm.fields.description.label}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder={siteContent.communityRequests.newRequestForm.fields.description.placeholder}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-600"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {siteContent.communityRequests.newRequestForm.submitButton}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* My Requests Section */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your requests...</p>
        </div>
      ) : myRequests && myRequests.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {siteContent.communityRequests.myRequests.heading} ({myRequests.length})
          </h2>
          <div className="space-y-3">
            {myRequests.map((request) => {
              const queuePosition = queuePositions[request.id];
              const requestsAhead = queuePosition !== undefined ? queuePosition : null;
              
              return (
                <div
                  key={request.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                          {request.status === "pending" 
                            ? siteContent.communityRequests.myRequests.statusLabels.pending 
                            : request.status === "fulfilled" 
                              ? siteContent.communityRequests.myRequests.statusLabels.fulfilled 
                              : request.status}
                        </span>
                        {request.status === "pending" && requestsAhead !== null && (
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            {requestsAhead === 0 
                              ? "Next in queue!" 
                              : `${requestsAhead} request${requestsAhead === 1 ? '' : 's'} ahead`}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm mb-1">
                        Series: {request.series.join(", ")}
                      </p>

                      {request.description && (
                        <p className="text-gray-700 text-sm mb-1">
                          {request.description}
                        </p>
                      )}

                      <p className="text-xs text-gray-500">
                        {siteContent.communityRequests.myRequests.requestedOn}{" "}
                        {request.requested_timestamp
                          ? new Date(request.requested_timestamp).toLocaleDateString()
                          : siteContent.communityRequests.myRequests.notSpecified}
                      </p>

                      {request.fulfilled_post_id && (
                        <a
                          href={`https://www.patreon.com/posts/${request.fulfilled_post_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                        >
                          {siteContent.communityRequests.myRequests.viewFulfilledPost}
                        </a>
                      )}
                    </div>

                    {request.status === "pending" && (
                      <button
                        onClick={() => handleMarkDoneClick(request.id)}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                      >
                        {siteContent.communityRequests.myRequests.markAsDoneButton}
                      </button>
                    )}
                  </div>

                  {/* Inline Confirmation Section */}
                  {deleteConfirm === request.id && (
                    <div className="border-t border-gray-300 bg-gray-50 pt-3 mt-3 transition-all duration-300 ease-in-out">
                      <p className="text-gray-900 font-medium mb-3">
                        {siteContent.communityRequests.myRequests.confirmationPrompt}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={confirmMarkDone}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {siteContent.communityRequests.myRequests.confirmButton}
                        </button>
                        <button
                          onClick={cancelMarkDone}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          {siteContent.communityRequests.myRequests.cancelButton}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : !loading && (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Tracked Requests
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You haven't tracked any requests yet. Use the form above to record your character requests to VAMA.
          </p>
        </div>
      )}
    </div>
  );
}
