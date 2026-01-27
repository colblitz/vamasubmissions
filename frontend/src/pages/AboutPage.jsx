import { useState, useEffect } from "react";
import axios from "axios";
import { siteContent } from "../content/siteContent";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AboutPage() {
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/users/leaderboard`);
      setLeaderboard(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {siteContent.about.heading}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: About Content */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {siteContent.about.welcome.heading}
            </h2>
            <div className="max-w-3xl text-gray-700">
              {siteContent.about.welcome.paragraphs.map((paragraph, idx) => (
                <p key={idx} className="text-base md:text-sm leading-relaxed mb-6">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {siteContent.about.features.heading}
            </h2>
            <div className="max-w-3xl text-gray-700">
              <ul className="list-disc list-inside space-y-3 text-base md:text-sm leading-relaxed">
                {siteContent.about.features.list.map((feature, idx) => (
                  <li key={idx}>
                    <strong>{feature.title}:</strong> {feature.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {siteContent.about.howItWorks.heading}
            </h2>
            <div className="max-w-3xl text-gray-700">
              {siteContent.about.howItWorks.sections.map((section, idx) => (
                <p key={idx} className="text-base md:text-sm leading-relaxed mb-6">
                  <strong>{section.title}:</strong> {section.description}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-3">
              {siteContent.about.disclaimer.heading}
            </h2>
            <p className="text-base md:text-sm text-blue-800 leading-relaxed max-w-3xl">
              {siteContent.about.disclaimer.text}
            </p>
          </div>
        </div>

        {/* Right Column: Leaderboards */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          ) : leaderboard ? (
            <>
              {/* Top Suggesters */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">🏆</span>
                  {siteContent.about.leaderboard.topContributors.heading}
                </h2>
                {leaderboard.top_suggesters.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {siteContent.about.leaderboard.topContributors.emptyState}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.top_suggesters.map((user, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`text-lg font-bold ${
                              index === 0
                                ? "text-yellow-500"
                                : index === 1
                                  ? "text-gray-400"
                                  : index === 2
                                    ? "text-orange-600"
                                    : "text-gray-600"
                            }`}
                          >
                            {index === 0
                              ? "🥇"
                              : index === 1
                                ? "🥈"
                                : index === 2
                                  ? "🥉"
                                  : `#${index + 1}`}
                          </span>
                          <span className="font-medium text-gray-900">
                            {user.username}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                          {user.count} {user.count === 1 ? siteContent.about.leaderboard.topContributors.editLabel : siteContent.about.leaderboard.topContributors.editsLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Approvers */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="text-2xl mr-2">✅</span>
                  {siteContent.about.leaderboard.topReviewers.heading}
                </h2>
                {leaderboard.top_approvers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {siteContent.about.leaderboard.topReviewers.emptyState}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.top_approvers.map((user, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`text-lg font-bold ${
                              index === 0
                                ? "text-yellow-500"
                                : index === 1
                                  ? "text-gray-400"
                                  : index === 2
                                    ? "text-orange-600"
                                    : "text-gray-600"
                            }`}
                          >
                            {index === 0
                              ? "🥇"
                              : index === 1
                                ? "🥈"
                                : index === 2
                                  ? "🥉"
                                  : `#${index + 1}`}
                          </span>
                          <span className="font-medium text-gray-900">
                            {user.username}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                          {user.count}{" "}
                          {user.count === 1 ? siteContent.about.leaderboard.topReviewers.approvalLabel : siteContent.about.leaderboard.topReviewers.approvalsLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats Summary */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {siteContent.about.leaderboard.stats.heading}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600">
                      {leaderboard.top_suggesters.reduce(
                        (sum, user) => sum + user.count,
                        0,
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {siteContent.about.leaderboard.stats.totalSuggested}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {leaderboard.top_approvers.reduce(
                        (sum, user) => sum + user.count,
                        0,
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {siteContent.about.leaderboard.stats.totalApproved}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
