import { useState } from "react";
import api from "../../services/api";
import { normalizeText } from "../../utils/validation";

export default function SuggestGlobalEditForm({ onSuccess }) {
  const [conditionField, setConditionField] = useState("characters");
  const [pattern, setPattern] = useState("");
  const [action, setAction] = useState("ADD");
  const [actionField, setActionField] = useState("characters");
  const [actionValue, setActionValue] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePreview = async () => {
    setError("");
    setPreview(null);

    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) {
      setError("Pattern cannot be empty");
      return;
    }

    setLoading(true);
    try {
      // Preview only needs condition_field and pattern
      const payload = {
        field_name: conditionField,
        pattern: normalizedPattern,
      };
      
      const response = await api.post("/api/global-edits/preview", payload);
      setPreview(response.data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to preview";
      // Handle validation errors
      if (Array.isArray(errorMsg)) {
        setError(errorMsg.map(e => e.msg).join(", "));
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) {
      setError("Pattern is required");
      return;
    }

    if (action === "ADD") {
      const normalizedActionValue = normalizeText(actionValue);
      if (!normalizedActionValue) {
        setError("Action value is required for ADD action");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        condition_field: conditionField,
        pattern: normalizedPattern,
        action: action,
      };

      if (action === "ADD") {
        payload.action_field = actionField;
        payload.action_value = normalizeText(actionValue);
      } else {
        // For DELETE, condition_field and action_field are the same
        payload.action_field = conditionField;
      }

      await api.post("/api/global-edits/suggest", payload);

      const actionText = action === "ADD" 
        ? `"${normalizedPattern}" → "${normalizeText(actionValue)}"` 
        : `Delete "${normalizedPattern}"`;
      
      setSuccess(`Global edit suggested: ${actionText}`);
      setPattern("");
      setActionValue("");
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
        Add or remove values across all posts at once. Supports wildcards for pattern matching (case-insensitive).
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

      <div className="space-y-6 mb-4">
        {/* Condition Section */}
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Condition</h3>
          
          {/* Condition Field Selection */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Field
            </label>
            <select
              value={conditionField}
              onChange={(e) => setConditionField(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="characters">Characters</option>
              <option value="series">Series</option>
              <option value="tags">Tags</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Which field to match the pattern on
            </p>
          </div>

          {/* Pattern Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pattern
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., Marin* or Naruto Uzamaki"
              className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use * for wildcards (e.g., "Marin*" matches "Marin", "Marina", "Marine"). Matching is case-insensitive.
            </p>
          </div>
        </div>

        {/* Action Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Action</h3>
          
          {/* Action Type Selection */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ADD"
                  checked={action === "ADD"}
                  onChange={(e) => setAction(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-900">Add/Replace</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="DELETE"
                  checked={action === "DELETE"}
                  onChange={(e) => setAction(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-900">Delete</span>
              </label>
            </div>
          </div>

          {/* Action Field (only for ADD) */}
          {action === "ADD" && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Field
              </label>
              <select
                value={actionField}
                onChange={(e) => setActionField(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="characters">Characters</option>
                <option value="series">Series</option>
                <option value="tags">Tags</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Which field to add the value to
              </p>
            </div>
          )}

          {/* Action Value (only for ADD) */}
          {action === "ADD" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Value
              </label>
              <input
                type="text"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder="e.g., Naruto Uzumaki"
                className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                The value to add or replace matching patterns with
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={!pattern || loading}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Preview Affected Posts"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!pattern || (action === "ADD" && !actionValue) || loading}
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
              No posts found matching pattern "{pattern}"
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {preview.affected_posts.map((post) => (
                <div key={post.id} className="bg-gray-50 p-3 rounded text-sm">
                  <div className="font-medium text-gray-900">{post.title}</div>
                  <div className="text-gray-600 mt-1">
                    Current: {post.current_values.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
