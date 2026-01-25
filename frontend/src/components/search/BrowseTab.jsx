import { useState, useEffect } from "react";
import api from "../../services/api";

/**
 * BrowseTab component - Browse all characters, series, and tags with counts
 * Click any item to filter posts by that value
 */
export default function BrowseTab({ onSelectItem }) {
  const [activeSubTab, setActiveSubTab] = useState("characters");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    limit: 32, // 8 rows x 4 columns on large screens
  });

  // Fetch browse data when sub-tab changes
  useEffect(() => {
    fetchBrowseData();
  }, [activeSubTab, pagination.page]);

  const fetchBrowseData = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/api/posts/browse/${activeSubTab}`, {
        params: {
          page: pagination.page,
          limit: pagination.limit,
        },
      });

      setItems(response.data.items || []);
      setPagination({
        page: response.data.page,
        total: response.data.total,
        totalPages: response.data.total_pages,
        limit: response.data.limit,
      });
    } catch (err) {
      console.error("Failed to fetch browse data:", err);
      setError("Failed to load browse data. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (itemName) => {
    // Call parent callback to switch to search tab with this filter
    if (onSelectItem) {
      onSelectItem(activeSubTab, itemName);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-200 -mt-2">
        <button
          onClick={() => {
            setActiveSubTab("characters");
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === "characters"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Characters
        </button>
        <button
          onClick={() => {
            setActiveSubTab("series");
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === "series"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Series
        </button>
        <button
          onClick={() => {
            setActiveSubTab("tags");
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === "tags"
              ? "text-purple-600 border-b-2 border-purple-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Tags
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-600">
          Loading {activeSubTab}...
        </div>
      )}

      {/* Items Grid */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleItemClick(item.name)}
                className={`px-3 py-2 rounded-lg border-2 transition-all hover:shadow-md text-left ${
                  activeSubTab === "characters"
                    ? "border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100"
                    : activeSubTab === "series"
                      ? "border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100"
                      : "border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-medium text-gray-900 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="text-sm text-gray-600 flex-shrink-0">
                    ({item.count})
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-gray-700 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>
          )}

          {/* Total Count */}
          <div className="text-center text-xs text-gray-500 mt-2">
            Total: {pagination.total} {activeSubTab}
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-8 text-gray-600">
          No {activeSubTab} found.
        </div>
      )}
    </div>
  );
}
