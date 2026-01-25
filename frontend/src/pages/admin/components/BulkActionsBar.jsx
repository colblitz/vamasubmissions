/**
 * BulkActionsBar Component
 *
 * Displays a bar with bulk action controls for managing multiple items.
 * Shows selection status and provides buttons for bulk operations.
 *
 * @param {Object} props - Component props
 * @param {number} props.selectedCount - Number of currently selected items
 * @param {number} props.totalCount - Total number of items available for selection
 * @param {Function} props.onSelectAll - Callback when "Select All" checkbox is toggled
 * @param {Function} props.onBulkSave - Callback when "Save Selected" button is clicked
 * @param {Function} props.onBulkPublish - Callback when "Publish Selected" button is clicked
 * @param {Function} props.onBulkDelete - Callback when "Delete Selected" button is clicked
 */
export default function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onBulkSave,
  onBulkPublish,
  onBulkDelete,
}) {
  // Determine if all items are selected
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Select All Section */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">
              Select All ({selectedCount} selected)
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onBulkSave}
            disabled={selectedCount === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Selected ({selectedCount})
          </button>

          <button
            onClick={onBulkPublish}
            disabled={selectedCount === 0}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publish Selected ({selectedCount})
          </button>

          <button
            onClick={onBulkDelete}
            disabled={selectedCount === 0}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
