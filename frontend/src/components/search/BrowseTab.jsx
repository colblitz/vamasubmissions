import { useState, useEffect } from "react";
import api from "../../services/api";

/**
 * BrowseTab component - Browse all characters, series, tags, months, and days with counts
 * Click any item to filter posts by that value
 */
export default function BrowseTab({ onSelectItem }) {
  const [activeSubTab, setActiveSubTab] = useState("characters");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("count"); // "count" or "alpha"
  const [noItemsCount, setNoItemsCount] = useState(0); // Count for no tags/characters/series
  const [startsWith, setStartsWith] = useState(null); // Letter filter for alpha sort
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    limit: 32, // 8 rows x 4 columns on large screens
  });

  // Fetch browse data when sub-tab, sort, or startsWith changes
  useEffect(() => {
    if (activeSubTab === "months" || activeSubTab === "days") {
      fetchBrowseByDate();
    } else {
      fetchBrowseData();
    }
  }, [activeSubTab, pagination.page, sortBy, startsWith]);

  // Fetch count of posts with no items for current tab (only for character/series/tags)
  useEffect(() => {
    if (activeSubTab === "characters" || activeSubTab === "series" || activeSubTab === "tags") {
      fetchNoItemsCount();
    } else {
      setNoItemsCount(0);
    }
  }, [activeSubTab]);

  const fetchBrowseData = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sort_by: sortBy,
      };
      
      // Add starts_with parameter if in alpha mode and a letter is selected
      if (sortBy === "alpha" && startsWith) {
        params.starts_with = startsWith;
      }
      
      const response = await api.get(`/api/posts/browse/${activeSubTab}`, { params });

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

  const fetchNoItemsCount = async () => {
    try {
      // Call the no-items-count endpoint for the current field type
      const response = await api.get(`/api/posts/browse/${activeSubTab}/no-items-count`);
      setNoItemsCount(response.data.count || 0);
    } catch (err) {
      console.error("Failed to fetch no items count:", err);
      setNoItemsCount(0);
    }
  };

  const fetchBrowseByDate = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      const endpoint = activeSubTab === "months" ? "/api/posts/browse/months" : "/api/posts/browse/days";
      const response = await api.get(endpoint, { params });

      setItems(response.data.items || []);
      setPagination({
        page: response.data.page,
        total: response.data.total,
        totalPages: response.data.total_pages,
        limit: response.data.limit,
      });
    } catch (err) {
      console.error("Failed to fetch date browse data:", err);
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
    // Clear startsWith when manually navigating pages
    setStartsWith(null);
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLetterClick = (letter) => {
    // Set the letter and reset to page 1
    // The backend will calculate the correct page based on the letter
    setStartsWith(letter);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-3">
      {/* Sub-tabs and Sort Dropdown */}
      <div className="flex justify-between items-center border-b border-gray-200 -mt-2">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveSubTab("characters");
              setPagination((prev) => ({ ...prev, page: 1 }));
              if (sortBy === "date") setSortBy("count");
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
              if (sortBy === "date") setSortBy("count");
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
              if (sortBy === "date") setSortBy("count");
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeSubTab === "tags"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Tags
          </button>
          <button
            onClick={() => {
              setActiveSubTab("months");
              setPagination((prev) => ({ ...prev, page: 1 }));
              setSortBy("date");
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeSubTab === "months"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            By Month
          </button>
          <button
            onClick={() => {
              setActiveSubTab("days");
              setPagination((prev) => ({ ...prev, page: 1 }));
              setSortBy("date");
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeSubTab === "days"
                ? "text-pink-600 border-b-2 border-pink-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            By Day
          </button>
        </div>

        {/* Sort Dropdown - Top Right (hidden for date-based browsing) */}
        {activeSubTab !== "months" && activeSubTab !== "days" && (
          <div className="flex items-center gap-2 pb-2">
            <label className="text-xs text-gray-600 whitespace-nowrap">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="count">Most Popular</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>
        )}
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
          Loading {activeSubTab === "months" ? "months" : activeSubTab === "days" ? "days" : activeSubTab}...
        </div>
      )}

      {/* Items Grid */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleItemClick(item.name)}
                className={`px-2 py-1.5 rounded border-2 transition-all hover:shadow-md text-left ${
                  activeSubTab === "characters"
                    ? "border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100"
                    : activeSubTab === "series"
                      ? "border-green-200 hover:border-green-400 bg-green-50 hover:bg-green-100"
                      : activeSubTab === "tags"
                        ? "border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100"
                        : activeSubTab === "months"
                          ? "border-orange-200 hover:border-orange-400 bg-orange-50 hover:bg-orange-100"
                          : "border-pink-200 hover:border-pink-400 bg-pink-50 hover:bg-pink-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-medium text-gray-900 text-base truncate"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="text-base text-gray-600 flex-shrink-0">
                    ({item.count})
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* No Items Button */}
          {noItemsCount > 0 && (
            <div className="mt-4">
              <button
                onClick={() => {
                  const fieldMap = {
                    characters: "no_characters",
                    series: "no_series",
                    tags: "no_tags",
                  };
                  if (onSelectItem) {
                    onSelectItem(fieldMap[activeSubTab], true);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100 transition-all text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-700 text-sm md:text-base">
                    No {activeSubTab === "characters" ? "Characters" : activeSubTab === "series" ? "Series" : "Tags"}
                  </span>
                  <span className="text-sm text-gray-600 flex-shrink-0">
                    ({noItemsCount})
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Alphabet Navigation (only in alpha mode for non-date tabs) */}
          {sortBy === "alpha" && activeSubTab !== "months" && activeSubTab !== "days" && (
            <div className="flex justify-center items-center gap-1 mt-4 flex-wrap">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                const isCurrentLetter = 
                  items.length > 0 && 
                  items[0].name && 
                  items[0].name.charAt(0).toUpperCase() === letter;

                return (
                  <button
                    key={letter}
                    onClick={() => handleLetterClick(letter)}
                    className={`px-2 py-1 rounded text-sm ${
                      isCurrentLetter
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                    }`}
                    aria-label={`Jump to ${letter}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}

          {/* Page Navigation (always show if multiple pages) */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4 flex-wrap">
              {/* Previous Button */}
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-3 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 min-h-[44px]"
                aria-label="Previous page"
              >
                ←
              </button>

              {/* Page Numbers */}
              {(() => {
                    const pages = [];
                    const maxVisible = 7;
                    const current = pagination.page;
                    const totalPages = pagination.totalPages;

                    if (totalPages <= maxVisible) {
                      // Show all pages
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Show with ellipsis
                      if (current <= 4) {
                        // Near start: 1 2 3 4 5 ... 20
                        for (let i = 1; i <= 5; i++) {
                          pages.push(i);
                        }
                        pages.push("...");
                        pages.push(totalPages);
                      } else if (current >= totalPages - 3) {
                        // Near end: 1 ... 16 17 18 19 20
                        pages.push(1);
                        pages.push("...");
                        for (let i = totalPages - 4; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // In middle: 1 ... 5 6 7 ... 20
                        pages.push(1);
                        pages.push("...");
                        for (let i = current - 1; i <= current + 1; i++) {
                          pages.push(i);
                        }
                        pages.push("...");
                        pages.push(totalPages);
                      }
                    }

                    return pages.map((page, index) => {
                      if (page === "...") {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="px-4 py-3 text-gray-900 flex items-center min-h-[44px]"
                          >
                            ...
                          </span>
                        );
                      }

                      const isCurrentPage = page === current;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          disabled={isCurrentPage}
                          className={`px-4 py-3 rounded min-h-[44px] ${
                            isCurrentPage
                              ? "bg-blue-600 text-white cursor-default"
                              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                          }`}
                          aria-label={`Page ${page}`}
                          aria-current={isCurrentPage ? "page" : undefined}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-3 bg-gray-200 text-gray-900 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 min-h-[44px]"
                aria-label="Next page"
              >
                →
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
