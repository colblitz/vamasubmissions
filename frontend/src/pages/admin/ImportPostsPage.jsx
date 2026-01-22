import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function ImportPostsPage() {
  const { user } = useAuth();
  const [pendingPosts, setPendingPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Bulk selection
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Fetch pending posts
  const fetchPendingPosts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/admin/posts/pending', {
        params: { limit: 50 }
      });
      setPendingPosts(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load pending posts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch new posts from Patreon
  const handleFetchNew = async () => {
    if (!confirm('Fetch new posts from Patreon? This may take a minute.')) return;
    
    setFetching(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await api.post('/api/admin/posts/fetch-new', {
        since_days: 7
      });
      
      setSuccess(`Imported ${response.data.imported} new posts, ${response.data.skipped} already existed`);
      fetchPendingPosts();  // Refresh list
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch new posts');
    } finally {
      setFetching(false);
    }
  };

  // Bulk publish
  const handleBulkPublish = async () => {
    if (selectedPosts.length === 0) {
      alert('No posts selected');
      return;
    }
    
    if (!confirm(`Publish ${selectedPosts.length} selected posts?`)) return;
    
    try {
      const response = await api.post('/api/admin/posts/bulk-publish', selectedPosts);
      
      alert(`Published ${response.data.published.length} posts, ${response.data.failed.length} failed`);
      setSelectedPosts([]);
      fetchPendingPosts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to bulk publish');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) {
      alert('No posts selected');
      return;
    }
    
    if (!confirm(`Delete ${selectedPosts.length} selected posts? This cannot be undone.`)) return;
    
    try {
      const response = await api.delete('/api/admin/posts/bulk-delete', {
        data: selectedPosts
      });
      
      alert(`Deleted ${response.data.deleted.length} posts, ${response.data.failed.length} failed`);
      setSelectedPosts([]);
      fetchPendingPosts();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to bulk delete');
    }
  };

  // Toggle post selection
  const togglePostSelection = (postId) => {
    setSelectedPosts(prev => {
      if (prev.includes(postId)) {
        return prev.filter(id => id !== postId);
      } else {
        return [...prev, postId];
      }
    });
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedPosts.length === pendingPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(pendingPosts.map(p => p.id));
    }
  };

  useEffect(() => {
    fetchPendingPosts();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Import Posts</h1>
        
        <button
          onClick={handleFetchNew}
          disabled={fetching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {fetching ? 'Fetching...' : 'Fetch New Posts from Patreon'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Bulk Actions */}
      {pendingPosts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPosts.length === pendingPosts.length && pendingPosts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedPosts.length} selected)
                </span>
              </label>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleBulkPublish}
                disabled={selectedPosts.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Publish Selected ({selectedPosts.length})
              </button>
              
              <button
                onClick={handleBulkDelete}
                disabled={selectedPosts.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Selected ({selectedPosts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Posts Count */}
      <div className="mb-4 text-gray-600">
        {pendingPosts.length} pending post{pendingPosts.length !== 1 ? 's' : ''} awaiting review
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      ) : pendingPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          No pending posts. Click "Fetch New Posts" to import from Patreon.
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map(post => (
            <PendingPostCard 
              key={post.id} 
              post={post}
              isSelected={selectedPosts.includes(post.id)}
              onToggleSelect={() => togglePostSelection(post.id)}
              onUpdate={fetchPendingPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingPostCard({ post, isSelected, onToggleSelect, onUpdate }) {
  const [characters, setCharacters] = useState(post.characters || []);
  const [series, setSeries] = useState(post.series || []);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // Character autocomplete
  const [characterInput, setCharacterInput] = useState('');
  const [characterSuggestions, setCharacterSuggestions] = useState([]);
  
  // Series autocomplete
  const [seriesInput, setSeriesInput] = useState('');
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);

  // Fetch character suggestions
  const fetchCharacterSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setCharacterSuggestions([]);
      return;
    }
    
    try {
      const response = await api.get('/api/posts/autocomplete/characters', {
        params: { q: query, limit: 10 }
      });
      setCharacterSuggestions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch character suggestions:', err);
    }
  };

  // Fetch series suggestions
  const fetchSeriesSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSeriesSuggestions([]);
      return;
    }
    
    try {
      const response = await api.get('/api/posts/autocomplete/series', {
        params: { q: query, limit: 10 }
      });
      setSeriesSuggestions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch series suggestions:', err);
    }
  };

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      if (characterInput) fetchCharacterSuggestions(characterInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [characterInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (seriesInput) fetchSeriesSuggestions(seriesInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [seriesInput]);

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    
    try {
      await api.patch(`/api/admin/posts/${post.id}`, {
        characters,
        series
      });
      
      alert('Changes saved!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Publish post
  const handlePublish = async () => {
    if (!characters.length || !series.length) {
      alert('Please add at least one character and series before publishing');
      return;
    }
    
    if (!confirm('Publish this post? It will become visible in search results.')) return;
    
    setPublishing(true);
    
    try {
      // Save first
      await api.patch(`/api/admin/posts/${post.id}`, {
        characters,
        series
      });
      
      // Then publish
      await api.post(`/api/admin/posts/${post.id}/publish`);
      
      alert('Post published successfully!');
      onUpdate();  // Refresh list
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to publish post');
    } finally {
      setPublishing(false);
    }
  };

  // Delete post
  const handleDelete = async () => {
    if (!confirm('Delete this pending post? This cannot be undone.')) return;
    
    try {
      await api.delete(`/api/admin/posts/${post.id}`);
      alert('Post deleted');
      onUpdate();  // Refresh list
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete post');
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex gap-6">
        {/* Checkbox */}
        <div className="flex items-start pt-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 cursor-pointer"
          />
        </div>
        
        {/* Thumbnail */}
        {post.thumbnail_urls?.[0] ? (
          <img 
            src={post.thumbnail_urls[0]} 
            alt={post.title}
            className="w-48 h-48 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div className="w-48 h-48 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400">No preview</span>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
          
          <div className="text-sm text-gray-500 mb-4">
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              View on Patreon
            </a>
            <span className="mx-2">•</span>
            <span>{new Date(post.timestamp).toLocaleDateString()}</span>
          </div>
          
          {/* Characters Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Characters *
            </label>
            <div className="relative">
              <input
                type="text"
                value={characterInput}
                onChange={(e) => setCharacterInput(e.target.value)}
                placeholder="Type to search..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
              {characterSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {characterSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!characters.includes(suggestion)) {
                          setCharacters([...characters, suggestion]);
                        }
                        setCharacterInput('');
                        setCharacterSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {characters.map((char, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {char}
                  <button
                    onClick={() => setCharacters(characters.filter((_, i) => i !== idx))}
                    className="hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Series Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Series *
            </label>
            <div className="relative">
              <input
                type="text"
                value={seriesInput}
                onChange={(e) => setSeriesInput(e.target.value)}
                placeholder="Type to search..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
              {seriesSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {seriesSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!series.includes(suggestion)) {
                          setSeries([...series, suggestion]);
                        }
                        setSeriesInput('');
                        setSeriesSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {series.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {s}
                  <button
                    onClick={() => setSeries(series.filter((_, i) => i !== idx))}
                    className="hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            
            <button
              onClick={handlePublish}
              disabled={publishing || !characters.length || !series.length}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
            
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 ml-auto"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
