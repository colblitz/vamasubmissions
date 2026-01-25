import { useState } from "react";
import api from "../../services/api";

export default function PendingGlobalEdits({ globalEdits, onRefresh }) {
  const [confirmingAction, setConfirmingAction] = useState(null); // {editId, action}
  const [successMessages, setSuccessMessages] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedPreview, setExpandedPreview] = useState(null); // editId
  const [previewData, setPreviewData] = useState({});

  const handleActionClick = (editId, action) => {
    setConfirmingAction({ editId, action });
    setErrorMessage("");
  };

  const cancelConfirmation = () => {
    setConfirmingAction(null);
  };

  const executeAction = async () => {
    if (!confirmingAction) return;

    const { editId, action } = confirmingAction;
    setConfirmingAction(null);
    setErrorMessage("");

    try {
      if (action === "approve") {
        await api.post(`/api/global-edits/${editId}/approve`);
        setSuccessMessages((prev) => ({ ...prev, [editId]: "✓ Approved & Applied!" }));
        setTimeout(() => {
          setSuccessMessages((prev) => {
            const { [editId]: _, ...rest } = prev;
            return rest;
          });
          if (onRefresh) onRefresh();
        }, 1500);
      } else if (action === "reject") {
        await api.post(`/api/global-edits/${editId}/reject`);
        setSuccessMessages((prev) => ({ ...prev, [editId]: "✓ Rejected" }));
        setTimeout(() => {
          setSuccessMessages((prev) => {
            const { [editId]: _, ...rest } = prev;
            return rest;
          });
          if (onRefresh) onRefresh();
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || `Failed to ${action} global edit`);
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  const togglePreview = async (editId) => {
    if (expandedPreview === editId) {
      setExpandedPreview(null);
      return;
    }

    // Fetch preview if not already loaded
    if (!previewData[editId]) {
      try {
        const response = await api.get(`/api/global-edits/${editId}/preview`);
        setPreviewData((prev) => ({ ...prev, [editId]: response.data }));
      } catch (err) {
        setErrorMessage("Failed to load preview");
        setTimeout(() => setErrorMessage(""), 3000);
        return;
      }
    }

    setExpandedPreview(editId);
  };

  const formatFieldName = (fieldName) => {
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  };

  if (!globalEdits || globalEdits.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No pending global edits
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      {globalEdits.map((edit) => (
        <div key={edit.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-4 items-start">
            {/* Icon */}
            <div className="w-12 h-12 flex-shrink-0 bg-purple-100 rounded flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                  GLOBAL
                </span>
                <span className="text-sm text-gray-600">
                  {formatFieldName(edit.field_name)}
                </span>
              </div>
              <div className="text-sm text-gray-900 mb-1">
                <span className="font-medium text-red-600">"{edit.old_value}"</span>
                {" → "}
                <span className="font-medium text-green-600">"{edit.new_value}"</span>
              </div>
              <div className="text-xs text-gray-500">
                Affects {edit.affected_count} post{edit.affected_count !== 1 ? "s" : ""} •{" "}
                Suggested by {edit.suggester_username} •{" "}
                {new Date(edit.created_at).toLocaleDateString()}
              </div>

              {/* Preview Toggle */}
              <button
                onClick={() => togglePreview(edit.id)}
                className="text-xs text-blue-600 hover:text-blue-800 mt-2"
              >
                {expandedPreview === edit.id ? "Hide Preview" : "Show Preview"}
              </button>

              {/* Expanded Preview */}
              {expandedPreview === edit.id && previewData[edit.id] && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    Affected Posts ({previewData[edit.id].affected_count}):
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {previewData[edit.id].affected_posts.slice(0, 10).map((post) => (
                      <div key={post.id} className="bg-gray-50 p-2 rounded text-xs">
                        <div className="font-medium text-gray-900">{post.title}</div>
                        <div className="text-gray-600 mt-1">
                          Current: {post.current_values.join(", ")}
                        </div>
                      </div>
                    ))}
                    {previewData[edit.id].affected_posts.length > 10 && (
                      <p className="text-gray-500 text-xs italic">
                        ... and {previewData[edit.id].affected_posts.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              {successMessages[edit.id] ? (
                <span className="text-green-600 font-medium text-sm whitespace-nowrap">
                  {successMessages[edit.id]}
                </span>
              ) : confirmingAction?.editId === edit.id ? (
                <>
                  {confirmingAction.action === "approve" && (
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
                  {confirmingAction.action === "reject" && (
                    <div className="flex flex-col gap-2">
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
                <>
                  <button
                    onClick={() => handleActionClick(edit.id, "approve")}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 whitespace-nowrap"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleActionClick(edit.id, "reject")}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 whitespace-nowrap"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
