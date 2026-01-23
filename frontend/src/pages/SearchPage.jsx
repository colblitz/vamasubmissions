import { useState, useEffect } from "react";
import api from "../services/api";
import SearchFilters from "../components/search/SearchFilters";
import SearchResults from "../components/search/SearchResults";
import EditModal from "../components/search/EditModal";

export default function SearchPage() {
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
  const [resultsPendingEdits, setResultsPendingEdits] = useState({});

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

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

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (characterInput) fetchAutocomplete("characters", characterInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [characterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (seriesInput) fetchAutocomplete("series", seriesInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [seriesInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tagInput) fetchAutocomplete("tags", tagInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [tagInput]);

  // Search posts
  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: searchParams.page,
        limit: searchParams.limit,
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

      // Fetch pending edits for all posts in results
      fetchPendingEditsForResults(posts);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending edits for all posts in search results
  const fetchPendingEditsForResults = async (posts) => {
    const pendingEditsMap = {};

    await Promise.all(
      posts.map(async (post) => {
        try {
          const response = await api.get(`/api/edits/pending-for-post/${post.id}`);
          pendingEditsMap[post.id] = response.data || [];
        } catch (err) {
          console.error(`Failed to fetch pending edits for post ${post.id}:`, err);
          pendingEditsMap[post.id] = [];
        }
      })
    );

    setResultsPendingEdits(pendingEditsMap);
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

  // Handle edit modal
  const openEditModal = (post) => {
    setSelectedPost(post);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedPost(null);
  };

  // Refresh pending edits after successful edit submission
  const handleEditSuccess = () => {
    if (results.length > 0) {
      fetchPendingEditsForResults(results);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Search Posts</h1>

      {/* Search Filters */}
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

      {/* Search Results */}
      <SearchResults
        results={results}
        total={total}
        loading={loading}
        error={error}
        pendingEditsMap={resultsPendingEdits}
        pagination={{ page: searchParams.page, limit: searchParams.limit }}
        onPageChange={handlePageChange}
        onEditClick={openEditModal}
        sortParams={{ sortBy: searchParams.sortBy, sortOrder: searchParams.sortOrder }}
        onSortChange={handleSortChange}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        post={selectedPost}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
