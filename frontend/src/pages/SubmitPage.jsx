import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { submissionsAPI } from "../services/api";

export default function SubmitPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

    // Create previews
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

    // Validation
    if (user.tier > 1 && user.credits < creditCost) {
      alert(
        `Not enough credits. You need ${creditCost} credits but have ${user.credits}.`,
      );
      return;
    }

    if (images.length === 0) {
      alert("Please upload at least one image");
      return;
    }

    try {
      setLoading(true);

      // Create submission
      const submissionFormData = new FormData();
      submissionFormData.append("character_name", formData.character_name);
      submissionFormData.append("series", formData.series);
      submissionFormData.append("description", formData.description);
      submissionFormData.append(
        "is_large_image_set",
        formData.is_large_image_set,
      );
      submissionFormData.append(
        "is_double_character",
        formData.is_double_character,
      );

      const response = await submissionsAPI.create(submissionFormData);
      const submissionId = response.data.id;

      // Upload images
      await submissionsAPI.uploadImages(submissionId, images);

      alert("Submission created successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to create submission:", error);
      alert(error.response?.data?.detail || "Failed to create submission");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">New Character Submission</h1>

        {/* Credit Info */}
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Current Credits: {user.credits} / {user.max_credits}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This submission will cost: {creditCost} credit
                {creditCost !== 1 ? "s" : ""}
              </p>
            </div>
            {user.tier > 1 && user.credits < creditCost && (
              <span className="text-red-600 font-semibold">
                [ERROR] Not enough credits
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Character Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Character Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.character_name}
              onChange={(e) =>
                setFormData({ ...formData, character_name: e.target.value })
              }
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
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {seriesSuggestions.map((series, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, series });
                      setSeriesSuggestions([]);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {series}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              rows="6"
              placeholder="Describe your character request in detail..."
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.description.length} characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Images <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-sm text-gray-500 mt-1">
              Upload up to 20 images (max 10MB each)
            </p>

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
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">
                Request Modifiers
              </h3>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_large_image_set}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_large_image_set: e.target.checked,
                    })
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
                    setFormData({
                      ...formData,
                      is_double_character: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">
                  Double character (+1 credit)
                </span>
              </label>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || (user.tier > 1 && user.credits < creditCost)}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Submitting..."
                : `Submit (${creditCost} credit${creditCost !== 1 ? "s" : ""})`}
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
