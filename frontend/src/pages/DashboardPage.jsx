import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { submissionsAPI } from "../services/api";

export default function DashboardPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    character_name: "",
    series: "",
    description: "",
    is_large_image_set: false,
    is_double_character: false,
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await submissionsAPI.list();
      setSubmissions(response.data);
    } catch (error) {
      console.error("Failed to load submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate credit cost
  const calculateCost = () => {
    let cost = 1;
    if (formData.is_large_image_set) cost += 1;
    if (formData.is_double_character) cost += 1;
    return cost;
  };

  const creditCost = calculateCost();

  // Series autocomplete
  const handleSeriesChange = async (value) => {
    setFormData({ ...formData, series: value });

    if (value.length > 2) {
      try {
        const response = await submissionsAPI.autocompleteSeries(value);
        setSeriesSuggestions(response.data.series || []);
      } catch (error) {
        console.error("Failed to fetch series suggestions:", error);
      }
    } else {
      setSeriesSuggestions([]);
    }
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 20) {
      alert("Maximum 20 images allowed");
      return;
    }

    setImages(files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  // Remove image
  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (user.tier > 1 && user.credits < creditCost) {
      alert(`Not enough credits. You need ${creditCost} credits but have ${user.credits}.`);
      return;
    }

    if (images.length === 0) {
      alert("Please upload at least one image");
      return;
    }

    try {
      setSubmitting(true);

      const submissionFormData = new FormData();
      submissionFormData.append("character_name", formData.character_name);
      submissionFormData.append("series", formData.series);
      submissionFormData.append("description", formData.description);
      submissionFormData.append("is_large_image_set", formData.is_large_image_set);
      submissionFormData.append("is_double_character", formData.is_double_character);

      const response = await submissionsAPI.create(submissionFormData);
      const submissionId = response.data.id;

      await submissionsAPI.uploadImages(submissionId, images);

      alert("Submission created successfully!");

      // Reset form
      setFormData({
        character_name: "",
        series: "",
        description: "",
        is_large_image_set: false,
        is_double_character: false,
      });
      setImages([]);
      setImagePreviews([]);

      // Reload submissions
      await loadSubmissions();
    } catch (error) {
      console.error("Failed to create submission:", error);
      alert(error.response?.data?.detail || "Failed to create submission");
    } finally {
      setSubmitting(false);
    }
  };

  // Search
  const handleSearch = async (e) => {
    e.preventDefault();

    try {
      setSearching(true);
      setHasSearched(true);
      const response = await submissionsAPI.search(searchQuery);
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      alert("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
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
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user.patreon_username}!</p>

        {user.tier > 1 && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Credits:{" "}
              <span className="font-bold text-gray-900">
                {user.credits} / {user.max_credits}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* New Submission Form */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">New Submission</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Character Name */}
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

            {/* Series */}
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

          {/* Description */}
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

          {/* Image Upload */}
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

          {/* Request Modifiers (Tier 2+ only) */}
          {user.tier > 1 && (
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_large_image_set}
                  onChange={(e) =>
                    setFormData({ ...formData, is_large_image_set: e.target.checked })
                  }
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
                  onChange={(e) =>
                    setFormData({ ...formData, is_double_character: e.target.checked })
                  }
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
            {submitting
              ? "Submitting..."
              : `Submit (${creditCost} credit${creditCost !== 1 ? "s" : ""})`}
          </button>
        </form>
      </div>

      {/* Search Completed Requests */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Search Completed Requests</h2>

        <form onSubmit={handleSearch} className="flex gap-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by character name or series..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
          />
          <button type="submit" className="btn-primary" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {hasSearched && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>

            {searchResults.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No results found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((submission) => (
                  <Link
                    key={submission.id}
                    to={`/submission/${submission.id}`}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {submission.character_name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{submission.series}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(submission.completed_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* My Submissions */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">My Submissions</h2>

        {submissions.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No submissions yet</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Link
                key={submission.id}
                to={`/submission/${submission.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {submission.character_name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(submission.status)}`}
                      >
                        {submission.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium text-gray-900">Series:</span> {submission.series}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                      </span>
                      {submission.queue_position && (
                        <span>Position: #{submission.queue_position}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-blue-600 hover:text-blue-700">View →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
