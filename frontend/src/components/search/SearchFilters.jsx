import AutocompleteInput from "./AutocompleteInput";

/**
 * SearchFilters component - Handles all search filter inputs
 * 
 * @param {object} searchParams - Current search parameters
 * @param {function} onSearchParamsChange - Callback when search params change
 * @param {function} onSearch - Callback to trigger search
 * @param {function} onClear - Callback to clear search
 * @param {object} autocomplete - Autocomplete state and handlers
 */
export default function SearchFilters({
  searchParams,
  onSearchParamsChange,
  onSearch,
  onClear,
  autocomplete,
}) {
  // Add filter chip
  const addFilter = (type, value) => {
    onSearchParamsChange({
      ...searchParams,
      [type]: [...searchParams[type], value],
      page: 1,
    });

    // Clear input and suggestions
    if (type === "characters") {
      autocomplete.setCharacterInput("");
      autocomplete.setCharacterSuggestions([]);
    }
    if (type === "series") {
      autocomplete.setSeriesInput("");
      autocomplete.setSeriesSuggestions([]);
    }
    if (type === "tags") {
      autocomplete.setTagInput("");
      autocomplete.setTagSuggestions([]);
    }
  };

  // Remove filter chip
  const removeFilter = (type, value) => {
    onSearchParamsChange({
      ...searchParams,
      [type]: searchParams[type].filter((v) => v !== value),
      page: 1,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="space-y-4">
        {/* Title Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by Title
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchParams.query}
              onChange={(e) =>
                onSearchParamsChange({ ...searchParams, query: e.target.value, page: 1 })
              }
              onKeyPress={(e) => {
                if (e.key === "Enter" && searchParams.query.trim()) {
                  onSearch();
                }
              }}
              placeholder="Search post titles..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={onSearch}
              disabled={!searchParams.query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
            {searchParams.query && (
              <button
                onClick={onClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Search across post titles, characters, series, and tags
          </p>
        </div>

        {/* Characters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Characters</label>
          <AutocompleteInput
            value={autocomplete.characterInput}
            onChange={autocomplete.setCharacterInput}
            onSelect={(value) => addFilter("characters", value)}
            suggestions={autocomplete.characterSuggestions}
            placeholder="Type to search characters..."
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {searchParams.characters.map((char, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {char}
                <button
                  onClick={() => removeFilter("characters", char)}
                  className="hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Series */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Series</label>
          <AutocompleteInput
            value={autocomplete.seriesInput}
            onChange={autocomplete.setSeriesInput}
            onSelect={(value) => addFilter("series", value)}
            suggestions={autocomplete.seriesSuggestions}
            placeholder="Type to search series..."
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {searchParams.series.map((s, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {s}
                <button onClick={() => removeFilter("series", s)} className="hover:text-green-600">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <AutocompleteInput
            value={autocomplete.tagInput}
            onChange={autocomplete.setTagInput}
            onSelect={(value) => addFilter("tags", value)}
            suggestions={autocomplete.tagSuggestions}
            placeholder="Type to search tags..."
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {searchParams.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
              >
                {tag}
                <button onClick={() => removeFilter("tags", tag)} className="hover:text-purple-600">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
