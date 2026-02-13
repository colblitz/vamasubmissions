import { useState, useEffect, useMemo } from "react";
import { debounce } from "lodash";
import api from "../services/api";
import SearchFilters from "../components/search/SearchFilters";
import SearchResults from "../components/search/SearchResults";
import BrowseTab from "../components/search/BrowseTab";

export default function SearchPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("search"); // "search" | "browse"

  // Search parameters
  const [searchParams, setSearchParams] = useState({
    query: "",
    characters: [],
    series: [],
    tags: [],
    noCharacters: false,
    noSeries: false,
    noTags: false,
    dateFrom: null,
    dateTo: null,
    page: 1,
    limit: 20,
    sortBy: "date",
    sortOrder: "desc",
  });

  // Results state
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resolvedAliases, setResolvedAliases] = useState({});
  const [latestPostDate, setLatestPostDate] = useState(null);

  // Autocomplete states for filters
  const [characterInput, setCharacterInput] = useState("");
  const [seriesInput, setSeriesInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  // Fetch autocomplete suggestions
  const fetchAutocomplete = async (type, query) => {
    if (!query || query.length < 3) {
      if (type === "characters") setCharacterSuggestions([]);
      if (type === "series") setSeriesSuggestions([]);
      if (type === "tags") setTagSuggestions([]);
      return;
    }

    try {
      const response = await api.get(`/api/posts/autocomplete/${type}`, {
        params: { q: query, limit: 100 }, // Substring matching: worst case "a" = 310 matches
      });

      if (type === "characters") setCharacterSuggestions(response.data || []);
      if (type === "series") setSeriesSuggestions(response.data || []);
      if (type === "tags") setTagSuggestions(response.data || []);
    } catch (err) {
      console.error(`Autocomplete error for ${type}:`, err);
    }
  };

  // Create stable debounced functions using useMemo
  const debouncedFetchCharacters = useMemo(
    () => debounce((query) => fetchAutocomplete("characters", query), 300),
    [],
  );

  const debouncedFetchSeries = useMemo(
    () => debounce((query) => fetchAutocomplete("series", query), 300),
    [],
  );

  const debouncedFetchTags = useMemo(
    () => debounce((query) => fetchAutocomplete("tags", query), 300),
    [],
  );

  // Fetch post stats on mount
  const [postStats, setPostStats] = useState(null);
  useEffect(() => {
    const fetchPostStats = async () => {
      try {
        const response = await api.get("/api/posts/post-stats");
        setPostStats(response.data);
        setLatestPostDate(response.data.latest_date);
      } catch (err) {
        console.error("Error fetching post stats:", err);
      }
    };
    fetchPostStats();
  }, []);

  // Debounced autocomplete using lodash debounce
  useEffect(() => {
    if (characterInput) {
      debouncedFetchCharacters(characterInput);
    } else {
      setCharacterSuggestions([]);
    }
  }, [characterInput, debouncedFetchCharacters]);

  useEffect(() => {
    if (seriesInput) {
      debouncedFetchSeries(seriesInput);
    } else {
      setSeriesSuggestions([]);
    }
  }, [seriesInput, debouncedFetchSeries]);

  useEffect(() => {
    if (tagInput) {
      debouncedFetchTags(tagInput);
    } else {
      setTagSuggestions([]);
    }
  }, [tagInput, debouncedFetchTags]);

  // Search posts
  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: searchParams.page,
        limit: searchParams.limit,
        sort_by: searchParams.sortBy,
        sort_order: searchParams.sortOrder,
      };

      if (searchParams.query?.trim()) {
        params.q = searchParams.query.trim();
      }

      if (searchParams.characters.length > 0) {
        params.characters = searchParams.characters.join(",");
      }
      if (searchParams.series.length > 0) {
        params.series = searchParams.series.join(",");
      }
      if (searchParams.tags.length > 0) {
        params.tags = searchParams.tags.join(",");
      }
      if (searchParams.noCharacters) {
        params.no_characters = true;
      }
      if (searchParams.noSeries) {
        params.no_series = true;
      }
      if (searchParams.noTags) {
        params.no_tags = true;
      }
      if (searchParams.dateFrom) {
        params.date_from = searchParams.dateFrom;
      }
      if (searchParams.dateTo) {
        params.date_to = searchParams.dateTo;
      }

      const response = await api.get("/api/posts/search", { params });

      const posts = response.data.posts || [];
      setResults(posts);
      setTotal(response.data.total || 0);
      setResolvedAliases(response.data.resolved_aliases || {});
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters or sort changes
  useEffect(() => {
    // Only trigger if we have results or filters applied
    if (
      results.length > 0 ||
      searchParams.characters.length > 0 ||
      searchParams.series.length > 0 ||
      searchParams.tags.length > 0 ||
      searchParams.noCharacters ||
      searchParams.noSeries ||
      searchParams.noTags ||
      searchParams.dateFrom ||
      searchParams.dateTo
    ) {
      handleSearch();
    }
  }, [
    searchParams.characters,
    searchParams.series,
    searchParams.tags,
    searchParams.noCharacters,
    searchParams.noSeries,
    searchParams.noTags,
    searchParams.dateFrom,
    searchParams.dateTo,
    searchParams.sortBy,
    searchParams.sortOrder,
    searchParams.page,
  ]);

  // Handle clear search
  const handleClear = () => {
    setSearchParams((prev) => ({ 
      ...prev, 
      query: "", 
      characters: [],
      series: [],
      tags: [],
      noCharacters: false,
      noSeries: false,
      noTags: false,
      dateFrom: null,
      dateTo: null,
      page: 1 
    }));
    setResults([]);
    setTotal(0);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setSearchParams((prev) => ({ ...prev, page: newPage }));
  };

  // Handle sort change
  const handleSortChange = ({ sortBy, sortOrder }) => {
    setSearchParams((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
  };

  // Handle edit success - only reload if explicitly requested
  const handleEditSuccess = (message, shouldReload = true) => {
    // If shouldReload is false, the child component is handling the update locally
    // so we don't need to trigger a full page reload
    if (shouldReload) {
      handleSearch();
    }
  };

  // Handle browse item selection
  const handleBrowseItemSelect = (fieldType, itemName) => {
    // Only switch to search tab for character/series/tag browsing
    // For date-based browsing, stay on the current tab and just show results
    if (fieldType !== "months" && fieldType !== "days") {
      setActiveTab("search");
    }

    // Apply the filter based on field type
    if (fieldType === "characters") {
      setSearchParams((prev) => ({ ...prev, characters: [itemName], noCharacters: false, noSeries: false, noTags: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "series") {
      setSearchParams((prev) => ({ ...prev, series: [itemName], noCharacters: false, noSeries: false, noTags: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "tags") {
      setSearchParams((prev) => ({ ...prev, tags: [itemName], noCharacters: false, noSeries: false, noTags: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "no_characters") {
      setSearchParams((prev) => ({ ...prev, noCharacters: true, characters: [], noSeries: false, noTags: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "no_series") {
      setSearchParams((prev) => ({ ...prev, noSeries: true, series: [], noCharacters: false, noTags: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "no_tags") {
      setSearchParams((prev) => ({ ...prev, noTags: true, tags: [], noCharacters: false, noSeries: false, dateFrom: null, dateTo: null, page: 1 }));
    } else if (fieldType === "months" || fieldType === "days") {
      // Date-based browsing - itemName is a date string (YYYY-MM for months, YYYY-MM-DD for days)
      // Parse the date to create a date range filter
      if (fieldType === "months") {
        // Month format: "YYYY-MM"
        const [year, month] = itemName.split("-");
        // Format dates using local timezone to avoid ISO conversion issues
        const formatLocalDate = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        setSearchParams((prev) => ({ 
          ...prev, 
          dateFrom: formatLocalDate(startDate),
          dateTo: formatLocalDate(endDate),
          characters: [],
          series: [],
          tags: [],
          noCharacters: false,
          noSeries: false,
          noTags: false,
          page: 1 
        }));
      } else if (fieldType === "days") {
        // Day format: "YYYY-MM-DD"
        setSearchParams((prev) => ({ 
          ...prev, 
          dateFrom: itemName,
          dateTo: itemName,
          characters: [],
          series: [],
          tags: [],
          noCharacters: false,
          noSeries: false,
          noTags: false,
          page: 1 
        }));
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">VAMA Posts</h1>
        {latestPostDate && (
          <div className="text-sm text-gray-500">
            Latest post: {new Date(latestPostDate).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("search")}
          className={`px-6 py-3 font-medium transition-colors min-h-[44px] ${
            activeTab === "search"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={`px-6 py-3 font-medium transition-colors min-h-[44px] ${
            activeTab === "browse"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Browse
        </button>
        <button
          onClick={() => {
            setActiveTab("search");
            // Set date range to all posts if available, otherwise clear filters
            setSearchParams({
              query: "",
              characters: [],
              series: [],
              tags: [],
              noCharacters: false,
              noSeries: false,
              noTags: false,
              dateFrom: postStats?.earliest_date ? postStats.earliest_date.split('T')[0] : null,
              dateTo: postStats?.latest_date ? postStats.latest_date.split('T')[0] : null,
              page: 1,
              limit: 20,
              sortBy: "date",
              sortOrder: "desc",
            });
            // Trigger search after state update
            setTimeout(() => handleSearch(), 0);
          }}
          className={`px-6 py-3 font-medium transition-colors min-h-[44px] ${
            activeTab === "all"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Browse All Posts
        </button>
      </div>

      {/* Fixed height container for Search/Browse sections */}
      <div className="h-[600px] overflow-y-auto mb-6 border border-gray-200 rounded-lg p-4 bg-white">
        {/* Search Filters (only show on Search tab) */}
        {activeTab === "search" && (
          <SearchFilters
            searchParams={searchParams}
            onSearchParamsChange={setSearchParams}
            onSearch={handleSearch}
            onClear={handleClear}
            autocomplete={{
              characterInput,
              setCharacterInput,
              characterSuggestions,
              setCharacterSuggestions,
              seriesInput,
              setSeriesInput,
              seriesSuggestions,
              setSeriesSuggestions,
              tagInput,
              setTagInput,
              tagSuggestions,
              setTagSuggestions,
            }}
          />
        )}

        {/* Browse Section (only show on Browse tab) */}
        {activeTab === "browse" && (
          <BrowseTab onSelectItem={handleBrowseItemSelect} />
        )}
      </div>

      {/* Shared Results Section */}
      <SearchResults
        results={results}
        total={total}
        loading={loading}
        error={error}
        pagination={{ page: searchParams.page, limit: searchParams.limit }}
        onPageChange={handlePageChange}
        onEditSuccess={handleEditSuccess}
        sortParams={{
          sortBy: searchParams.sortBy,
          sortOrder: searchParams.sortOrder,
        }}
        onSortChange={handleSortChange}
        resolvedAliases={resolvedAliases}
        dateFilter={(() => {
          if (searchParams.dateFrom && searchParams.dateTo) {
            if (searchParams.dateFrom === searchParams.dateTo) {
              return searchParams.dateFrom;
            }
            return `${searchParams.dateFrom} to ${searchParams.dateTo}`;
          }
          return null;
        })()}
      />
    </div>
  );
}
