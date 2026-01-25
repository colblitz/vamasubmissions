import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { submissionsAPI } from "../services/api";

export default function SubmissionEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [seriesSuggestions, setSeriesSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    character_name: "",
    series: "",
    description: "",
    is_public: false,
    is_large_image_set: false,
    is_double_character: false,
  });

  const [originalCost, setOriginalCost] = useState(1);

  useEffect(() => {
    loadSubmission();
  }, [id]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const response = await submissionsAPI.get(id);
      const sub = response.data;

      // Check permissions
      if (sub.user_id !== user.id) {
        alert("You can only edit your own submissions");
        navigate("/dashboard");
        return;
      }

      if (sub.status !== "pending") {
        alert("You can only edit pending submissions");
        navigate(`/submission/${id}`);
        return;
      }

      setSubmission(sub);
      setFormData({
        character_name: sub.character_name,
        series: sub.series,
        description: sub.description,
        is_public: sub.is_public,
        is_large_image_set: sub.is_large_image_set,
        is_double_character: sub.is_double_character,
      });
      setOriginalCost(sub.credit_cost);
    } catch (error) {
      console.error("Failed to load submission:", error);
      alert("Failed to load submission");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const calculateCost = () => {
    let cost = 1;
    if (formData.is_large_image_set) cost += 1;
    if (formData.is_double_character) cost += 1;
    return cost;
  };

  const newCost = calculateCost();
  const costDifference = newCost - originalCost;

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if user has enough credits for cost increase
    if (user.tier > 1 && costDifference > 0 && user.credits < costDifference) {
      alert(
        `Not enough credits. You need ${costDifference} more credit(s) but have ${user.credits}.`,
      );
      return;
    }

    try {
      setSaving(true);
      await submissionsAPI.update(id, formData);
      alert("Submission updated successfully!");
      navigate(`/submission/${id}`);
    } catch (error) {
      console.error("Failed to update submission:", error);
      alert(error.response?.data?.detail || "Failed to update submission");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading submission...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h1 className="text-3xl font-bold mb-6">Edit Submission</h1>

        {/* Cost Change Warning */}
        {costDifference !== 0 && (
          <div
            className={`border rounded-lg p-4 mb-6 ${
              costDifference > 0
                ? "bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700"
                : "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700"
            }`}
          >
            <p className="font-semibold">
              {costDifference > 0
                ? "[WARNING] Cost Increase"
                : "[INFO] Cost Decrease"}
            </p>
            <p className="text-sm mt-1">
              {costDifference > 0
                ? `This change will cost ${costDifference} additional credit(s). You have ${user.credits} credit(s) available.`
                : `This change will refund ${Math.abs(costDifference)} credit(s) to your account.`}
            </p>
            <p className="text-sm mt-1">
              Original cost: {originalCost} → New cost: {newCost}
            </p>
          </div>
        )}

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
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) =>
                  setFormData({ ...formData, is_public: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 font-medium">
                Make this submission public
              </span>
            </label>

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

          {/* Note about images */}
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">[INFO]</span> Images cannot be
              edited after submission. If you need to change images, please
              cancel this submission and create a new one.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={
                saving ||
                (user.tier > 1 &&
                  costDifference > 0 &&
                  user.credits < costDifference)
              }
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/submission/${id}`)}
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
