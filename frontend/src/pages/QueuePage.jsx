import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { queueAPI } from "../services/api";

export default function QueuePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("paid");
  const [paidQueue, setPaidQueue] = useState(null);
  const [freeQueue, setFreeQueue] = useState(null);
  const [voteAllowance, setVoteAllowance] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueues();
    if (user.tier === 1) {
      loadVoteInfo();
    }
  }, [user.tier]);

  const loadQueues = async () => {
    try {
      setLoading(true);
      const [paidResponse, freeResponse] = await Promise.all([
        queueAPI.getPaidQueue(),
        queueAPI.getFreeQueue(),
      ]);
      setPaidQueue(paidResponse.data);
      setFreeQueue(freeResponse.data);
    } catch (error) {
      console.error("Failed to load queues:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVoteInfo = async () => {
    try {
      const [allowanceResponse, votesResponse] = await Promise.all([
        queueAPI.getVoteAllowance(),
        queueAPI.getMyVotes(),
      ]);
      setVoteAllowance(allowanceResponse.data);
      setMyVotes(votesResponse.data.submission_ids);
    } catch (error) {
      console.error("Failed to load vote info:", error);
    }
  };

  const handleVote = async (submissionId) => {
    try {
      await queueAPI.vote(submissionId);
      await loadQueues();
      await loadVoteInfo();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to vote");
    }
  };

  const handleRemoveVote = async (submissionId) => {
    try {
      await queueAPI.removeVote(submissionId);
      await loadQueues();
      await loadVoteInfo();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to remove vote");
    }
  };

  const hasVoted = (submissionId) => myVotes.includes(submissionId);

  const renderSubmission = (submission, showVoting = false) => (
    <div
      key={submission.id}
      className={`bg-white border rounded-lg p-4 ${
        submission.is_own_submission
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {submission.is_own_submission ? submission.character_name : "???"}
            </h3>
            {submission.is_own_submission && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                YOUR SUBMISSION
              </span>
            )}
            {submission.is_public && !submission.is_own_submission && (
              <span className="text-sm text-gray-700">
                {submission.character_name}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium text-gray-900">Series:</span>{" "}
            {submission.is_own_submission || submission.is_public
              ? submission.series
              : "???"}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>Position: #{submission.queue_position}</span>
            <span>
              Submitted:{" "}
              {new Date(submission.submitted_at).toLocaleDateString()}
            </span>
            {submission.estimated_completion_date && (
              <span>
                Est. Completion:{" "}
                {new Date(
                  submission.estimated_completion_date,
                ).toLocaleDateString()}
              </span>
            )}
            {showVoting && (
              <span className="font-semibold text-blue-600">
                {submission.vote_count} vote
                {submission.vote_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {showVoting && !submission.is_own_submission && (
          <div>
            {hasVoted(submission.id) ? (
              <button
                onClick={() => handleRemoveVote(submission.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove Vote
              </button>
            ) : (
              <button
                onClick={() => handleVote(submission.id)}
                disabled={voteAllowance?.votes_remaining === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vote
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading queues...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Submission Queues
        </h1>
        <p className="text-gray-600">
          View the current queue status and your position
        </p>
      </div>

      {/* Vote Allowance (Tier 1 only) */}
      {user.tier === 1 && voteAllowance && (
        <div className="card bg-purple-50 border border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-2">
            Your Votes This Month
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-purple-600">
              {voteAllowance.votes_remaining}
            </div>
            <div className="text-sm text-gray-600">
              <p>
                {voteAllowance.votes_used} used /{" "}
                {voteAllowance.votes_available} available
              </p>
              <p className="text-xs">Votes reset monthly</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("paid")}
          className={`px-6 py-3 rounded-lg font-semibold ${
            activeTab === "paid"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Paid Queue ({paidQueue?.total_submissions || 0})
        </button>
        <button
          onClick={() => setActiveTab("free")}
          className={`px-6 py-3 rounded-lg font-semibold ${
            activeTab === "free"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Free Queue ({freeQueue?.total_submissions || 0})
        </button>
      </div>

      {/* Queue Content */}
      {activeTab === "paid" && paidQueue && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Paid Queue (FIFO)
            </h2>
            <p className="text-gray-600">
              Strict first-in-first-out ordering for tiers 2, 3, and 4
            </p>
            {paidQueue.user_position && (
              <p className="text-lg font-semibold text-blue-600 mt-2">
                Your position: #{paidQueue.user_position}
              </p>
            )}
          </div>

          {paidQueue.visible_submissions.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No submissions in paid queue
            </p>
          ) : (
            <div className="space-y-4">
              {paidQueue.visible_submissions.map((submission) =>
                renderSubmission(submission, false),
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "free" && freeQueue && (
        <div className="card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Free Queue (Vote-Based)
            </h2>
            <p className="text-gray-600">
              Ordered by community votes, then submission time
            </p>
            {freeQueue.user_position && (
              <p className="text-lg font-semibold text-blue-600 mt-2">
                Your position: #{freeQueue.user_position}
              </p>
            )}
          </div>

          {freeQueue.visible_submissions.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No submissions in free queue
            </p>
          ) : (
            <div className="space-y-4">
              {freeQueue.visible_submissions.map((submission) =>
                renderSubmission(submission, true),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
