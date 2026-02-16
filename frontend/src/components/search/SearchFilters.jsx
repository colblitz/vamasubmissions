import AutocompleteInput from "./AutocompleteInput";

/**
 * SearchFilters component - Handles all search filter inputs
 *
 * @param {object} searchParams - Current search parameters
 * @param {function} onSearchParamsChange - Callback when search params change
 * @param {function} onSearch - Callback to trigger search
 * @param {function} onClear - Callback to clear search
 * @param {object} autocomplete - Autocomplete state and handlers for include filters
 * @param {object} excludeAutocomplete - Autocomplete state and handlers for exclude filters
 */
export default function SearchFilters({
  searchParams,
  onSearchParamsChange,
  onSearch,
  onClear,
  autocomplete,
  excludeAutocomplete,
}) {
  // Add filter chip (include)
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

  // Add filter chip (exclude)
  const addExcludeFilter = (type, value) => {
    const excludeType =
      type === "characters"
        ? "excludeCharacters"
        : type === "series"
          ? "excludeSeries"
          : "excludeTags";
    onSearchParamsChange({
      ...searchParams,
      [excludeType]: [...searchParams[excludeType], value],
      page: 1,
    });

    // Clear input and suggestions
    if (type === "characters") {
      excludeAutocomplete.setCharacterInput("");
      excludeAutocomplete.setCharacterSuggestions([]);
    }
    if (type === "series") {
      excludeAutocomplete.setSeriesInput("");
      excludeAutocomplete.setSeriesSuggestions([]);
    }
    if (type === "tags") {
      excludeAutocomplete.setTagInput("");
      excludeAutocomplete.setTagSuggestions([]);
    }
  };

  // Remove filter chip (include)
  const removeFilter = (type, value) => {
    onSearchParamsChange({
      ...searchParams,
      [type]: searchParams[type].filter((v) => v !== value),
      page: 1,
    });
  };

  // Remove filter chip (exclude)
  const removeExcludeFilter = (type, value) => {
    const excludeType =
      type === "characters"
        ? "excludeCharacters"
        : type === "series"
          ? "excludeSeries"
          : "excludeTags";
    onSearchParamsChange({
      ...searchParams,
      [excludeType]: searchParams[excludeType].filter((v) => v !== value),
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
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={searchParams.query}
              onChange={(e) =>
                onSearchParamsChange({
                  ...searchParams,
                  query: e.target.value,
                  page: 1,
                })
              }
              onKeyPress={(e) => {
                if (e.key === "Enter" && searchParams.query.trim()) {
                  onSearch();
                }
              }}
              placeholder="Search post titles..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-600 min-h-[44px]"
            />
            <button
              onClick={onSearch}
              disabled={!searchParams.query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-h-[44px]"
            >
              Search
            </button>
            {(searchParams.query ||
              searchParams.characters.length > 0 ||
              searchParams.series.length > 0 ||
              searchParams.tags.length > 0 ||
              searchParams.excludeCharacters.length > 0 ||
              searchParams.excludeSeries.length > 0 ||
              searchParams.excludeTags.length > 0) && (
              <button
                onClick={onClear}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 whitespace-nowrap min-h-[44px]"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Search across post titles, characters, series, and tags
          </p>
        </div>

        {/* Characters - Side by Side */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Characters
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Include */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">
                Include
              </label>
              <AutocompleteInput
                value={autocomplete.characterInput}
                onChange={autocomplete.setCharacterInput}
                onSelect={(value) => addFilter("characters", value)}
                suggestions={autocomplete.characterSuggestions}
                placeholder="Add character..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.characters.map((char, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {char}
                    <button
                      onClick={() => removeFilter("characters", char)}
                      className="hover:text-green-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove ${char}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {searchParams.noCharacters && (
                  <span className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    No Characters
                    <button
                      onClick={() =>
                        onSearchParamsChange({
                          ...searchParams,
                          noCharacters: false,
                          page: 1,
                        })
                      }
                      className="hover:text-gray-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label="Remove no characters filter"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
            {/* Exclude */}
            <div className="relative">
              <label className="block text-xs text-red-500 mb-1">Exclude</label>
              <AutocompleteInput
                value={excludeAutocomplete.characterInput}
                onChange={excludeAutocomplete.setCharacterInput}
                onSelect={(value) => addExcludeFilter("characters", value)}
                suggestions={excludeAutocomplete.characterSuggestions}
                placeholder="Exclude character..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.excludeCharacters.map((char, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {char}
                    <button
                      onClick={() => removeExcludeFilter("characters", char)}
                      className="hover:text-red-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove exclude ${char}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Series - Side by Side */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Series
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Include */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">
                Include
              </label>
              <AutocompleteInput
                value={autocomplete.seriesInput}
                onChange={autocomplete.setSeriesInput}
                onSelect={(value) => addFilter("series", value)}
                suggestions={autocomplete.seriesSuggestions}
                placeholder="Add series..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.series.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {s}
                    <button
                      onClick={() => removeFilter("series", s)}
                      className="hover:text-green-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {searchParams.noSeries && (
                  <span className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    No Series
                    <button
                      onClick={() =>
                        onSearchParamsChange({
                          ...searchParams,
                          noSeries: false,
                          page: 1,
                        })
                      }
                      className="hover:text-gray-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label="Remove no series filter"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
            {/* Exclude */}
            <div className="relative">
              <label className="block text-xs text-red-500 mb-1">Exclude</label>
              <AutocompleteInput
                value={excludeAutocomplete.seriesInput}
                onChange={excludeAutocomplete.setSeriesInput}
                onSelect={(value) => addExcludeFilter("series", value)}
                suggestions={excludeAutocomplete.seriesSuggestions}
                placeholder="Exclude series..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.excludeSeries.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {s}
                    <button
                      onClick={() => removeExcludeFilter("series", s)}
                      className="hover:text-red-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove exclude ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tags - Side by Side */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Include */}
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">
                Include
              </label>
              <AutocompleteInput
                value={autocomplete.tagInput}
                onChange={autocomplete.setTagInput}
                onSelect={(value) => addFilter("tags", value)}
                suggestions={autocomplete.tagSuggestions}
                placeholder="Add tag..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => removeFilter("tags", tag)}
                      className="hover:text-green-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {searchParams.noTags && (
                  <span className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    No Tags
                    <button
                      onClick={() =>
                        onSearchParamsChange({
                          ...searchParams,
                          noTags: false,
                          page: 1,
                        })
                      }
                      className="hover:text-gray-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label="Remove no tags filter"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
            {/* Exclude */}
            <div className="relative">
              <label className="block text-xs text-red-500 mb-1">Exclude</label>
              <AutocompleteInput
                value={excludeAutocomplete.tagInput}
                onChange={excludeAutocomplete.setTagInput}
                onSelect={(value) => addExcludeFilter("tags", value)}
                suggestions={excludeAutocomplete.tagSuggestions}
                placeholder="Exclude tag..."
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {searchParams.excludeTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => removeExcludeFilter("tags", tag)}
                      className="hover:text-red-600 p-1 -mr-1 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      aria-label={`Remove exclude ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
