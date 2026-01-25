import { useState } from "react";
import api from "../../services/api";
import { normalizeText } from "../../utils/validation";

export default function SuggestGlobalEditForm({ onSuccess }) {
  const [fieldName, setFieldName] = useState("characters");
  const [oldValue, setOldValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePreview = async () => {
    setError("");
    setPreview(null);

    const normalizedOldValue = normalizeText(oldValue);
    if (!normalizedOldValue) {
      setError("Old value cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/global-edits/preview", null, {
        params: {
          field_name: fieldName,
          old_value: normalizedOldValue,
        },
      });
      setPreview(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to preview");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    const normalizedOldValue = normalizeText(oldValue);
    const normalizedNewValue = normalizeText(newValue);

    if (!normalizedOldValue || !normalizedNewValue) {
      setError("Both old and new values are required");
      return;
    }

    if (normalizedOldValue === normalizedNewValue) {
      setError("New value must be different from old value");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/global-edits/suggest", {
        field_name: fieldName,
        old_value: normalizedOldValue,
        new_value: normalizedNewValue,
      });

      setSuccess(
        `Global edit suggested: "${normalizedOldValue}" → "${normalizedNewValue}"`,
      );
      setOldValue("");
      setNewValue("");
      setPreview(null);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create suggestion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-900">
        Suggest Global Edit
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Fix typos or rename values across all posts at once (e.g., "Naruto
        Uzamaki" → "Naruto Uzumaki")
      </p>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Field Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Field
          </label>
          <select
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="characters">Characters</option>
            <option value="series">Series</option>
            <option value="tags">Tags</option>
          </select>
        </div>

        {/* Old Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Old Value (to replace)
          </label>
          <input
            type="text"
            value={oldValue}
            onChange={(e) => setOldValue(e.target.value)}
            placeholder="e.g., Naruto Uzamaki"
            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* New Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Value (replacement)
          </label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g., Naruto Uzumaki"
            className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={!oldValue || loading}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Preview Affected Posts"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!oldValue || !newValue || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Submitting..." : "Submit Global Edit"}
        </button>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Preview: {preview.affected_count} post
            {preview.affected_count !== 1 ? "s" : ""} will be affected
          </h3>
          {preview.affected_count === 0 ? (
            <p className="text-gray-600 text-sm">
              No posts found with "{oldValue}"
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {preview.affected_posts.slice(0, 10).map((post) => (
                <div key={post.id} className="bg-gray-50 p-3 rounded text-sm">
                  <div className="font-medium text-gray-900">{post.title}</div>
                  <div className="text-gray-600 mt-1">
                    Current: {post.current_values.join(", ")}
                  </div>
                </div>
              ))}
              {preview.affected_posts.length > 10 && (
                <p className="text-gray-500 text-sm italic">
                  ... and {preview.affected_posts.length - 10} more posts
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
