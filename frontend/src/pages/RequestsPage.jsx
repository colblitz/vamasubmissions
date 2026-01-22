import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function RequestsPage() {
  const { user } = useAuth();
  const [requestsQueue, setRequestsQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch(import.meta.env.VITE_API_URL + "/api/queue/requests", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      setRequestsQueue(data);
    } catch (error) {
      console.error("Failed to load requests queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderSubmission = (submission) => (
    <div
      key={submission.id}
      className={`bg-white border rounded-lg p-4 ${
        submission.is_own_submission ? "border-blue-500 bg-blue-50" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{submission.character_name}</h3>
            {submission.is_own_submission && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                YOUR SUBMISSION
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium text-gray-900">Series:</span> {submission.series}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>Position: #{submission.queue_position}</span>
            <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
            {submission.estimated_completion_date && (
              <span>
                Est. Completion:{" "}
                {new Date(submission.estimated_completion_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Queue</h1>
        <p className="text-gray-600">Strict first-in-first-out ordering for tier 2+ submissions</p>
        {requestsQueue?.user_position && (
          <p className="text-lg font-semibold text-blue-600 mt-2">
            Your position: #{requestsQueue.user_position}
          </p>
        )}
      </div>

      <div className="card">
        {!requestsQueue || requestsQueue.visible_submissions.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No submissions in requests queue</p>
        ) : (
          <div className="space-y-4">
            {requestsQueue.visible_submissions.map((submission) => renderSubmission(submission))}
          </div>
        )}
      </div>
    </div>
  );
}
