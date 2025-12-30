import { useState } from 'react';
import { submissionsAPI } from '../services/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    try {
      setLoading(true);
      setSearched(true);
      const response = await submissionsAPI.search(query);
      setResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Completed Requests</h1>
        <p className="text-gray-600 mb-6">
          Search by character name or series to find existing completed requests
        </p>

        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by character name or series..."
            className="input-field flex-1 bg-white text-gray-900"
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Results */}
      {searched && (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Search Results ({results.length})
          </h2>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No results found for "{query}"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((submission) => (
                <div
                  key={submission.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {submission.character_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {submission.series}
                    </p>
                  </div>

                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                    {submission.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {new Date(submission.completed_at).toLocaleDateString()}
                    </span>
                    {submission.patreon_post_url && (
                      <a
                        href={submission.patreon_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Post →
                      </a>
                    )}
                  </div>

                  {submission.is_large_image_set && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      Large Image Set
                    </span>
                  )}
                  {submission.is_double_character && (
                    <span className="inline-block mt-2 ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Double Character
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-blue-50 border border-blue-200">
        <h3 className="font-semibold mb-2 text-blue-900">
          [INFO] Search Tips
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Search results only show completed requests</li>
          <li>• You can see public requests and your own private requests</li>
          <li>• Use character names or series names to find similar requests</li>
          <li>• Check if your character has already been requested before submitting</li>
        </ul>
      </div>
    </div>
  );
}
