import { useState, useEffect } from "react";
import api from "../services/api";

export default function ReviewEditsPage() {
  const [pendingEdits, setPendingEdits] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' or 'history'
  
  // Banner messages (only for errors)
  const [errorMessage, setErrorMessage] = useState("");
  
  // Inline confirmation states - track which edit is in confirm mode
  const [confirmingAction, setConfirmingAction] = useState(null); // {editId, action: 'approve'|'reject'|'undo'}
  const [rejectReason, setRejectReason] = useState("");
  
  // Inline success messages per edit
  const [editSuccessMessages, setEditSuccessMessages] = useState({}); // {editId: "message"}

  // Fetch pending edits
  const fetchPending = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/edits/pending");
      setPendingEdits(response.data.edits);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load pending edits");
    } finally {
      setLoading(false);
    }
  };

  // Fetch edit history
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get("/api/edits/history", {
        params: { limit: 50 },
      });
      setHistory(response.data.history);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  // Handle action button click (first click - show confirmation)
  const handleActionClick = (editId, action) => {
    setConfirmingAction({ editId, action });
    setRejectReason("");
    setErrorMessage("");
  };

  // Cancel confirmation
  const cancelConfirmation = () => {
    setConfirmingAction(null);
    setRejectReason("");
  };

  // Execute action (second click - confirm)
  const executeAction = async () => {
    if (!confirmingAction) return;
    
    const { editId, action } = confirmingAction;
    setConfirmingAction(null);
    setErrorMessage("");

    try {
      if (action === 'approve') {
        await api.post(`/api/edits/${editId}/approve`);
        // Show inline success message
        setEditSuccessMessages(prev => ({ ...prev, [editId]: "✓ Approved!" }));
        // Remove from list after brief delay
        setTimeout(() => {
          setPendingEdits(prev => prev.filter(e => e.id !== editId));
          setEditSuccessMessages(prev => {
            const { [editId]: _, ...rest } = prev;
            return rest;
          });
        }, 1500);
      } else if (action === 'reject') {
        await api.post(`/api/edits/${editId}/reject`, { reason: rejectReason || undefined });
        setRejectReason("");
        // Show inline success message
        setEditSuccessMessages(prev => ({ ...prev, [editId]: "✓ Rejected" }));
        // Remove from list after brief delay
        setTimeout(() => {
          setPendingEdits(prev => prev.filter(e => e.id !== editId));
          setEditSuccessMessages(prev => {
            const { [editId]: _, ...rest } = prev;
            return rest;
          });
        }, 1500);
      } else if (action === 'undo') {
        await api.post(`/api/edits/history/${editId}/undo`);
        // Show inline success message
        setEditSuccessMessages(prev => ({ ...prev, [editId]: "✓ Undone!" }));
        // Remove from list after brief delay
        setTimeout(() => {
          setHistory(prev => prev.filter(e => e.id !== editId));
          setEditSuccessMessages(prev => {
            const { [editId]: _, ...rest } = prev;
            return rest;
          });
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || `Failed to ${action} edit`);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPending();
    } else {
      fetchHistory();
    }
  }, [activeTab]);

  // Helper to format field name
  const formatFieldName = (fieldName) => {
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  };

  // Helper to render action badge
  const renderActionBadge = (action) => {
    if (action === "ADD") {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          + ADD
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          - DELETE
        </span>
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Review Edits</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 font-medium ${
            activeTab === "pending"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Pending ({pendingEdits?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium ${
            activeTab === "history"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          History
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {successMessage}
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errorMessage}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === "pending" ? (
            <>
              {!pendingEdits || pendingEdits.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No pending edits to review</div>
              ) : (
                pendingEdits.map((edit) => (
                  <div
                    key={edit.id}
                    className="bg-white rounded-lg shadow p-4 flex gap-4 items-start"
                  >
                    {/* Thumbnail */}
                    {edit.post_thumbnail ? (
                      <img
                        src={edit.post_thumbnail}
                        alt={edit.post_title}
                        className="w-20 h-20 flex-shrink-0 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
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
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{edit.post_title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {renderActionBadge(edit.action)}
                        <span className="text-sm text-gray-600">
                          {formatFieldName(edit.field_name)}:
                        </span>
                        <span
                          className={`text-sm font-medium ${edit.action === "ADD" ? "text-green-700" : "text-red-700"}`}
                        >
                          {edit.value}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(edit.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {/* Show success message if present */}
                      {editSuccessMessages[edit.id] ? (
                        <span className="text-green-600 font-medium text-sm whitespace-nowrap">
                          {editSuccessMessages[edit.id]}
                        </span>
                      ) : confirmingAction?.editId === edit.id ? (
                        /* Confirmation state */
                        <>
                          {confirmingAction.action === 'approve' && (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={executeAction}
                                className="px-3 py-1.5 bg-green-700 text-white text-sm rounded hover:bg-green-800 font-medium whitespace-nowrap"
                              >
                                ✓ Confirm Approve
                              </button>
                              <button
                                onClick={cancelConfirmation}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {confirmingAction.action === 'reject' && (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason (optional)"
                                className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400"
                              />
                              <button
                                onClick={executeAction}
                                className="px-3 py-1.5 bg-red-700 text-white text-sm rounded hover:bg-red-800 font-medium whitespace-nowrap"
                              >
                                ✓ Confirm Reject
                              </button>
                              <button
                                onClick={cancelConfirmation}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        /* Initial state */
                        <>
                          <button
                            onClick={() => handleActionClick(edit.id, 'approve')}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 whitespace-nowrap"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleActionClick(edit.id, 'reject')}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {!history || history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No edit history yet</div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow p-4 flex gap-4 items-start"
                  >
                    {/* Thumbnail */}
                    {item.post_thumbnail ? (
                      <img
                        src={item.post_thumbnail}
                        alt={item.post_title}
                        className="w-20 h-20 flex-shrink-0 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
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
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{item.post_title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {renderActionBadge(item.action)}
                        <span className="text-sm text-gray-600">
                          {formatFieldName(item.field_name)}:
                        </span>
                        <span
                          className={`text-sm font-medium ${item.action === "ADD" ? "text-green-700" : "text-red-700"}`}
                        >
                          {item.value}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Approved by {item.approver_username} •{" "}
                        {new Date(item.applied_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {editSuccessMessages[item.id] ? (
                        <span className="text-green-600 font-medium text-sm whitespace-nowrap">
                          {editSuccessMessages[item.id]}
                        </span>
                      ) : confirmingAction?.editId === item.id && confirmingAction.action === 'undo' ? (
                        /* Confirmation state */
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={executeAction}
                            className="px-3 py-1.5 bg-yellow-700 text-white text-sm rounded hover:bg-yellow-800 font-medium whitespace-nowrap"
                          >
                            ✓ Confirm Undo
                          </button>
                          <button
                            onClick={cancelConfirmation}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        /* Initial state */
                        <button
                          onClick={() => handleActionClick(item.id, 'undo')}
                          className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 whitespace-nowrap"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
