import { useEffect, useState } from "react";
import { sortThumbnails } from "../../utils/thumbnailSort";

/**
 * PostThumbnailModal - Modal for viewing post thumbnails from ReviewEditsPage
 * 
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Callback to close modal
 * @param {object} post - Post object with title and thumbnail_urls
 * @param {object} edit - Edit object with id, field_name, action, value, suggester_username
 * @param {number} currentIndex - Current edit index
 * @param {number} totalEdits - Total number of edits
 * @param {function} onPrevious - Callback to navigate to previous edit
 * @param {function} onNext - Callback to navigate to next edit
 * @param {function} onApprove - Callback to approve edit (receives editId)
 * @param {function} onReject - Callback to reject edit (receives editId)
 * @param {boolean} canApprove - Whether current user can approve this edit
 * @param {boolean} showActions - Whether to show approve/reject buttons
 */
export default function PostThumbnailModal({ 
  isOpen, 
  onClose, 
  post,
  edit = null,
  currentIndex = null,
  totalEdits = null,
  onPrevious = null,
  onNext = null,
  onApprove = null,
  onReject = null,
  canApprove = false,
  showActions = false,
}) {
  const [thumbnailGridRef, setThumbnailGridRef] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(null); // 'approve' | 'reject' | null
  const [rejectReason, setRejectReason] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  // Reset confirmation state when edit changes
  useEffect(() => {
    setConfirmingAction(null);
    setRejectReason("");
    setActionInProgress(false);
  }, [edit?.id]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen || confirmingAction) return;
    
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && onPrevious && !actionInProgress) {
        onPrevious();
      } else if (e.key === "ArrowRight" && onNext && !actionInProgress) {
        onNext();
      } else if (e.key === "PageUp" && thumbnailGridRef) {
        e.preventDefault();
        thumbnailGridRef.scrollBy({ top: -thumbnailGridRef.clientHeight, behavior: 'smooth' });
      } else if (e.key === "PageDown" && thumbnailGridRef) {
        e.preventDefault();
        thumbnailGridRef.scrollBy({ top: thumbnailGridRef.clientHeight, behavior: 'smooth' });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onPrevious, onNext, thumbnailGridRef, confirmingAction, actionInProgress]);

  // Handle approve/reject with confirmation
  const handleApproveClick = () => {
    setConfirmingAction("approve");
    setRejectReason("");
  };

  const handleRejectClick = () => {
    setConfirmingAction("reject");
    setRejectReason("");
  };

  const handleConfirmAction = async () => {
    if (!edit || !confirmingAction) return;

    setActionInProgress(true);

    try {
      if (confirmingAction === "approve") {
        await onApprove(edit.id);
      } else if (confirmingAction === "reject") {
        await onReject(edit.id, rejectReason);
      }

      // After successful action, stay at same index since parent removes item from array
      // The next edit shifts into the current index position
      setTimeout(() => {
        setConfirmingAction(null);
        setRejectReason("");
        setActionInProgress(false);
        // Note: Parent component handles removing the item from the list,
        // so the modal automatically shows the next edit at the same index
      }, 500);
    } catch (err) {
      console.error("Action failed:", err);
      setActionInProgress(false);
      setConfirmingAction(null);
    }
  };

  const handleCancelAction = () => {
    setConfirmingAction(null);
    setRejectReason("");
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !post) return null;

  const sortedThumbnails = post.thumbnail_urls ? sortThumbnails(post.thumbnail_urls) : [];
  
  // Helper to format field name
  const formatFieldName = (fieldName) => {
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {post.title}
              </h2>
              {edit && (
                <div className="text-sm text-gray-600 mt-1">
                  {formatFieldName(edit.field_name)}:{" "}
                  <span className={`font-medium ${edit.action === "ADD" ? "text-green-700" : "text-red-700"}`}>
                    {edit.action === "ADD" ? "+" : "-"}
                    {edit.value}
                  </span>
                  {edit.suggester_username && (
                    <span className="text-xs text-gray-500 ml-2">
                      • Suggested by: {edit.suggester_username}
                    </span>
                  )}
                </div>
              )}
              {currentIndex !== null && totalEdits !== null && (
                <p className="text-xs text-gray-500 mt-1">
                  Edit {currentIndex + 1} of {totalEdits}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              title="Close (ESC)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {sortedThumbnails.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Images ({sortedThumbnails.length}) - Use PageUp/PageDown to scroll
              </h3>
              <div 
                ref={setThumbnailGridRef}
                className="grid grid-cols-[repeat(auto-fit,200px)] justify-start gap-3 max-h-[600px] overflow-y-auto"
              >
                {sortedThumbnails.map((url, idx) => (
                  <div key={idx} className="w-[200px] h-[200px] bg-gray-100 rounded overflow-hidden">
                    <img
                      src={url}
                      alt={`${post.title} - Image ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No images available
            </div>
          )}
        </div>

        {/* Footer with Navigation and Actions */}
        {(onPrevious || onNext || showActions) && (
          <div className="flex-shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              {/* Navigation Buttons */}
              <div className="flex items-center gap-2">
                {onPrevious && (
                  <button
                    onClick={onPrevious}
                    disabled={!onPrevious}
                    className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Previous edit (Left arrow)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {onNext && (
                  <button
                    onClick={onNext}
                    disabled={!onNext}
                    className="p-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Next edit (Right arrow)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              {showActions && edit && !actionInProgress && (
                <div className="flex items-center gap-2">
                  {confirmingAction === "approve" ? (
                    // Approve confirmation
                    <>
                      <button
                        onClick={handleConfirmAction}
                        disabled={actionInProgress}
                        className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50"
                      >
                        ✓ Confirm Approve
                      </button>
                      <button
                        onClick={handleCancelAction}
                        disabled={actionInProgress}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : confirmingAction === "reject" ? (
                    // Reject confirmation with reason input
                    <>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={handleConfirmAction}
                        disabled={actionInProgress}
                        className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-medium disabled:opacity-50"
                      >
                        ✓ Confirm Reject
                      </button>
                      <button
                        onClick={handleCancelAction}
                        disabled={actionInProgress}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    // Initial state
                    <>
                      {canApprove && onApprove && (
                        <button
                          onClick={handleApproveClick}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Approve
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={handleRejectClick}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          Reject
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {actionInProgress && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
