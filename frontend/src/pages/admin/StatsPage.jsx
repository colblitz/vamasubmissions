import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

const PERIODS = [
  { key: "day", label: "Past Day" },
  { key: "week", label: "Past 7 Days" },
  { key: "month", label: "Past 30 Days" },
  { key: "all", label: "All Time" },
];

const SEARCH_TABS = [
  { key: "chars", label: "Characters" },
  { key: "series", label: "Series" },
  { key: "tags", label: "Tags" },
];

export default function StatsPage() {
  const [period, setPeriod] = useState("all");
  const [searchTab, setSearchTab] = useState("chars");
  const [showLoginNames, setShowLoginNames] = useState(false);
  const [showSearchNames, setShowSearchNames] = useState(false);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/admin/stats", { params: { period } });
      const data = response.data;
      // Normalise: guarantee all array fields exist so renders never crash
      setStats({
        period: data.period ?? period,
        unique_visitors_by_login: data.unique_visitors_by_login ?? 0,
        unique_visitors_by_search: data.unique_visitors_by_search ?? 0,
        visitor_names_by_login: data.visitor_names_by_login ?? [],
        visitor_names_by_search: data.visitor_names_by_search ?? [],
        searches_per_user: data.searches_per_user ?? [],
        most_popular_chars: data.most_popular_chars ?? [],
        most_popular_series: data.most_popular_series ?? [],
        most_popular_tags: data.most_popular_tags ?? [],
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const popularSearches =
    stats
      ? searchTab === "chars"
        ? stats.most_popular_chars
        : searchTab === "series"
        ? stats.most_popular_series
        : stats.most_popular_tags
      : [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Site Stats</h1>
          <p className="text-sm text-gray-400 mt-1">
            Usage statistics from backend logs
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              period === p.key
                ? "bg-yellow-600 text-white font-medium"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !stats && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/4 mb-4" />
              <div className="h-8 bg-gray-700 rounded w-1/6" />
            </div>
          ))}
        </div>
      )}

      {stats && (
        <>
          {/* Unique Visitors */}
          <section className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Unique Visitors
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">
                  {stats.unique_visitors_by_login}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Logged in
                </div>
                <button
                  onClick={() => setShowLoginNames((v) => !v)}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                >
                  {showLoginNames ? "Hide names" : "Show names"}
                </button>
                {showLoginNames && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                    {stats.visitor_names_by_login.map((name) => (
                      <div key={name} className="text-xs text-gray-300 py-0.5">
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">
                  {stats.unique_visitors_by_search}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Searched
                </div>
                <button
                  onClick={() => setShowSearchNames((v) => !v)}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                >
                  {showSearchNames ? "Hide names" : "Show names"}
                </button>
                {showSearchNames && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                    {stats.visitor_names_by_search.map((name) => (
                      <div key={name} className="text-xs text-gray-300 py-0.5">
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Searches Per User */}
          <section className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Searches Per User
              <span className="ml-2 text-sm font-normal text-gray-400">
                (page 1 hits only, excludes pagination)
              </span>
            </h2>
            {stats.searches_per_user.length === 0 ? (
              <p className="text-gray-400 text-sm">No search data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 pr-4 font-medium w-8">#</th>
                      <th className="pb-2 pr-4 font-medium">Username</th>
                      <th className="pb-2 font-medium text-right">Searches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {stats.searches_per_user.map((row, i) => (
                      <tr
                        key={row.username}
                        className="hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-2 pr-4 text-gray-200">{row.username}</td>
                        <td className="py-2 text-right">
                          <span className="inline-block bg-gray-700 text-yellow-300 font-mono px-2 py-0.5 rounded text-xs">
                            {row.count.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Most Popular Searches */}
          <section className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Most Popular Searches
            </h2>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1 w-fit mb-4">
              {SEARCH_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSearchTab(t.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    searchTab === t.key
                      ? "bg-gray-700 text-white font-medium"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {popularSearches.length === 0 ? (
              <p className="text-gray-400 text-sm">No data for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 pr-4 font-medium w-8">#</th>
                      <th className="pb-2 pr-4 font-medium">Search Term</th>
                      <th className="pb-2 font-medium text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {popularSearches.map((row, i) => (
                      <tr
                        key={row.term}
                        className="hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                        <td className="py-2 pr-4 text-gray-200">{row.term}</td>
                        <td className="py-2 text-right">
                          <span className="inline-block bg-gray-700 text-blue-300 font-mono px-2 py-0.5 rounded text-xs">
                            {row.count.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
