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
        params: { q: query, limit: 100 },  // Substring matching: worst case "a" = 310 matches
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
    []
  );

  const debouncedFetchSeries = useMemo(
    () => debounce((query) => fetchAutocomplete("series", query), 300),
    []
  );

  const debouncedFetchTags = useMemo(
    () => debounce((query) => fetchAutocomplete("tags", query), 300),
    []
  );

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

      const response = await api.get("/api/posts/search", { params });

      const posts = response.data.posts || [];
      setResults(posts);
      setTotal(response.data.total || 0);
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
      searchParams.tags.length > 0
    ) {
      handleSearch();
    }
  }, [searchParams.characters, searchParams.series, searchParams.tags, searchParams.sortBy, searchParams.sortOrder, searchParams.page]);

  // Handle clear search
  const handleClear = () => {
    setSearchParams((prev) => ({ ...prev, query: "", page: 1 }));
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

  // Refresh search results after successful edit submission
  const handleEditSuccess = () => {
    handleSearch();
  };

  // Handle browse item selection
  const handleBrowseItemSelect = (fieldType, itemName) => {
    // Switch to search tab
    setActiveTab("search");
    
    // Apply the filter based on field type
    if (fieldType === "characters") {
      setSearchParams((prev) => ({ ...prev, characters: [itemName], page: 1 }));
    } else if (fieldType === "series") {
      setSearchParams((prev) => ({ ...prev, series: [itemName], page: 1 }));
    } else if (fieldType === "tags") {
      setSearchParams((prev) => ({ ...prev, tags: [itemName], page: 1 }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">VAMA Posts</h1>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("search")}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "search"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setActiveTab("browse")}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "browse"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Browse
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
        sortParams={{ sortBy: searchParams.sortBy, sortOrder: searchParams.sortOrder }}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
