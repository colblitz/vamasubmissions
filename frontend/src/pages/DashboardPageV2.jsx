import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { submissionsAPI } from '../services/api';

export default function DashboardPageV2() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tierRules, setTierRules] = useState(null);
  
  const [formData, setFormData] = useState({
    character_name: '',
    series: '',
    description: '',
    is_large_image_set: false,
    is_double_character: false,
  });
  
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    loadSubmissions();
    loadTierRules();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await submissionsAPI.list();
      setSubmissions(response.data);
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTierRules = async () => {
    try {
      const response = await fetch(import.meta.env.VITE_API_URL + '/api/users/me/tier-rules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setTierRules(data);
    } catch (error) {
      console.error('Failed to load tier rules:', error);
    }
  };

  const calculateCost = () => {
    let cost = 1;
    if (formData.is_large_image_set) cost += 1;
    if (formData.is_double_character) cost += 1;
    return cost;
  };

  const creditCost = calculateCost();

  const handleSeriesChange = async (value) => {
    setFormData({ ...formData, series: value });
    
    if (value.length > 2) {
      try {
        const response = await submissionsAPI.autocompleteSeries(value);
        setSeriesSuggestions(response.data.series || []);
      } catch (error) {
        console.error('Failed to fetch series suggestions:', error);
      }
    } else {
      setSeriesSuggestions([]);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 20) {
      alert('Maximum 20 images allowed');
      return;
    }

    setImages(files);
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (user.tier > 1 && user.credits < creditCost) {
      alert(`Not enough credits. You need ${creditCost} credits but have ${user.credits}.`);
      return;
    }

    if (images.length === 0) {
      alert('Please upload at least one image');
      return;
    }

    try {
      setSubmitting(true);

      const submissionFormData = new FormData();
      submissionFormData.append('character_name', formData.character_name);
      submissionFormData.append('series', formData.series);
      submissionFormData.append('description', formData.description);
      submissionFormData.append('is_large_image_set', formData.is_large_image_set);
      submissionFormData.append('is_double_character', formData.is_double_character);

      const response = await submissionsAPI.create(submissionFormData);
      const submissionId = response.data.id;

      await submissionsAPI.uploadImages(submissionId, images);

      alert('Submission created successfully!');
      
      setFormData({
        character_name: '',
        series: '',
        description: '',
        is_large_image_set: false,
        is_double_character: false,
      });
      setImages([]);
      setImagePreviews([]);
      
      await loadSubmissions();
    } catch (error) {
      console.error('Failed to create submission:', error);
      alert(error.response?.data?.detail || 'Failed to create submission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = async () => {
    try {
      setSearching(true);
      const response = await submissionsAPI.search(searchQuery);
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const startEdit = (submission) => {
    setEditingId(submission.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (submissionId, updatedData) => {
    try {
      const formData = new FormData();
      formData.append('character_name', updatedData.character_name);
      formData.append('series', updatedData.series);
      formData.append('description', updatedData.description);
      formData.append('is_large_image_set', updatedData.is_large_image_set);
      formData.append('is_double_character', updatedData.is_double_character);

      await submissionsAPI.update(submissionId, formData);
      setEditingId(null);
      await loadSubmissions();
    } catch (error) {
      console.error('Failed to update submission:', error);
      alert(error.response?.data?.detail || 'Failed to update submission');
    }
  };

  const cancelSubmission = async (submissionId) => {
    if (!confirm('Are you sure you want to cancel this submission?')) return;
    
    try {
      await submissionsAPI.cancel(submissionId);
      await loadSubmissions();
    } catch (error) {
      console.error('Failed to cancel submission:', error);
      alert(error.response?.data?.detail || 'Failed to cancel submission');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getTierRulesText = () => {
    if (!tierRules) return '';
    
    if (user.tier === 1) {
      return `Tier 1: ${tierRules.max_pending} pending request max, no carryover`;
    } else {
      return `Tier ${user.tier}: ${tierRules.credits_per_month} request${tierRules.credits_per_month > 1 ? 's' : ''}/month, ${tierRules.max_credits} max credits, ${tierRules.credit_expiry_months}-month expiry`;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="card">
        <p className="text-xl text-gray-900 mb-2">Welcome back, {user.patreon_username}!</p>
        {user.tier > 1 && (
          <>
            <p className="text-sm text-gray-600 mb-4">{getTierRulesText()}</p>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Credits: <span className="font-bold text-gray-900">{user.credits} / {user.max_credits}</span></p>
            </div>
          </>
        )}
      </div>

      {/* New Submission Form - Only for Tier 2+ */}
      {user.tier > 1 && (
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">New Submission</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Character Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.character_name}
                onChange={(e) => setFormData({ ...formData, character_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="e.g., Asuka Langley"
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Series <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.series}
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="e.g., Neon Genesis Evangelion"
              />
              {seriesSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {seriesSuggestions.map((series, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, series });
                        setSeriesSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
                    >
                      {series}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              rows="4"
              placeholder="Describe your character request..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Images <span className="text-red-500">*</span> (max 20, 10MB each)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {user.tier > 1 && (
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_large_image_set}
                  onChange={(e) => setFormData({ ...formData, is_large_image_set: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">
                  Large image set (+1 credit)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_double_character}
                  onChange={(e) => setFormData({ ...formData, is_double_character: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">
                  Double character (+1 credit)
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (user.tier > 1 && user.credits < creditCost)}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : `Submit (${creditCost} credit${creditCost !== 1 ? 's' : ''})`}
          </button>
        </form>
      </div>
      )}

      {/* Search Completed Requests */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Search Completed Requests</h2>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by character name or series..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 mb-4"
        />

        {searching && <p className="text-sm text-gray-600">Searching...</p>}

        {searchQuery && searchResults.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-4">Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
            
            <div className="space-y-3">
              {searchResults.map((submission) => (
                <div
                  key={submission.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {submission.character_name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{submission.series}</p>
                      <p className="text-xs text-gray-500 mb-2">
                        Completed: {new Date(submission.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {submission.patreon_post_url && (
                      <a
                        href={submission.patreon_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Patreon Post →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && !searching && searchResults.length === 0 && (
          <p className="text-center text-gray-600 py-8">No results found</p>
        )}
      </div>

      {/* My Submissions - Only for Tier 2+ */}
      {user.tier > 1 && (
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">My Submissions</h2>
        
        {submissions.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No submissions yet</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                isEditing={editingId === submission.id}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onCancel={cancelSubmission}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// Inline submission card component
function SubmissionCard({ submission, isEditing, onStartEdit, onCancelEdit, onSaveEdit, onCancel, getStatusBadge }) {
  const [editData, setEditData] = useState({
    character_name: submission.character_name,
    series: submission.series,
    description: submission.description,
    is_large_image_set: submission.is_large_image_set,
    is_double_character: submission.is_double_character,
  });
  
  const [images, setImages] = useState(submission.images || []);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [deletingImageId, setDeletingImageId] = useState(null);

  const handleAddImages = (e) => {
    const files = Array.from(e.target.files);
    const totalImages = images.length + newImages.length + files.length;
    
    if (totalImages > 20) {
      alert(`Maximum 20 images allowed. You have ${images.length + newImages.length}, trying to add ${files.length}`);
      return;
    }

    setNewImages([...newImages, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setNewImagePreviews([...newImagePreviews, ...previews]);
  };

  const removeNewImage = (index) => {
    const updatedImages = newImages.filter((_, i) => i !== index);
    const updatedPreviews = newImagePreviews.filter((_, i) => i !== index);
    setNewImages(updatedImages);
    setNewImagePreviews(updatedPreviews);
  };

  const deleteExistingImage = async (imageId) => {
    if (!confirm('Delete this image?')) return;
    
    try {
      setDeletingImageId(imageId);
      await submissionsAPI.deleteImage(submission.id, imageId);
      setImages(images.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert(error.response?.data?.detail || 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleSaveWithImages = async () => {
    try {
      // First, upload new images if any
      if (newImages.length > 0) {
        await submissionsAPI.uploadImages(submission.id, newImages);
      }
      
      // Then save the text changes
      await onSaveEdit(submission.id, editData);
      
      // Reset image state
      setNewImages([]);
      setNewImagePreviews([]);
    } catch (error) {
      console.error('Failed to save:', error);
      alert(error.response?.data?.detail || 'Failed to save changes');
    }
  };

  if (submission.status === 'completed') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {submission.character_name}
              </h3>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(submission.status)}`}>
                COMPLETED
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium text-gray-900">Series:</span> {submission.series}
            </p>
            
            <p className="text-xs text-gray-500">
              Completed: {new Date(submission.completed_at).toLocaleDateString()}
            </p>
          </div>
          
          {submission.patreon_post_url && (
            <a
              href={submission.patreon_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Patreon Post →
            </a>
          )}
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-white border border-blue-300 rounded-lg p-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Character Name</label>
            <input
              type="text"
              value={editData.character_name}
              onChange={(e) => setEditData({ ...editData, character_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
            <input
              type="text"
              value={editData.series}
              onChange={(e) => setEditData({ ...editData, series: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              rows="3"
            />
          </div>

          {/* Image Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Images ({images.length + newImages.length}/20)
            </label>
            
            {/* Existing Images */}
            {images.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-2">Current Images:</p>
                <div className="grid grid-cols-4 gap-2">
                  {images.map((image) => (
                    <div key={image.id} className="relative">
                      <img
                        src={`${import.meta.env.VITE_API_URL}${image.file_path}`}
                        alt="Reference"
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => deleteExistingImage(image.id)}
                        disabled={deletingImageId === image.id}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingImageId === image.id ? '...' : '×'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images to Upload */}
            {newImagePreviews.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-2">New Images to Upload:</p>
                <div className="grid grid-cols-4 gap-2">
                  {newImagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`New ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-blue-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Images Button */}
            {images.length + newImages.length < 20 && (
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddImages}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editData.is_large_image_set}
                onChange={(e) => setEditData({ ...editData, is_large_image_set: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Large image set (+1 credit)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editData.is_double_character}
                onChange={(e) => setEditData({ ...editData, is_double_character: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Double character (+1 credit)</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveWithImages}
              className="btn-primary flex-1"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {submission.character_name}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(submission.status)}`}>
              {submission.status.toUpperCase()}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium text-gray-900">Series:</span> {submission.series}
          </p>
          
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium text-gray-900">Description:</span> {submission.description}
          </p>

          {(submission.is_large_image_set || submission.is_double_character) && (
            <div className="flex gap-2 mb-2">
              {submission.is_large_image_set && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Large image set</span>
              )}
              {submission.is_double_character && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Double character</span>
              )}
            </div>
          )}

          {/* Display submitted images for pending requests */}
          {submission.status === 'pending' && submission.images && submission.images.length > 0 && (
            <div className="mt-3 mb-2">
              <p className="text-sm font-medium text-gray-900 mb-2">Reference Images ({submission.images.length}):</p>
              <div className="grid grid-cols-4 gap-2">
                {submission.images.map((image, index) => (
                  <img
                    key={index}
                    src={`${import.meta.env.VITE_API_URL}${image.file_path}`}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
            {submission.queue_position && (
              <span>Position: #{submission.queue_position}</span>
            )}
            <span>Cost: {submission.credit_cost} credit{submission.credit_cost !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {submission.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onStartEdit(submission)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => onCancel(submission.id)}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
