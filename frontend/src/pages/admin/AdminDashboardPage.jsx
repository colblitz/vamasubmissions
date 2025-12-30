import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">
          Overview of submissions, queues, and system statistics
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/submissions" className="card hover:border-blue-500 transition-colors border border-transparent">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Submissions</h3>
          <p className="text-sm text-gray-600">
            View, complete, and manage all submissions
          </p>
        </Link>
        <Link to="/admin/users" className="card hover:border-blue-500 transition-colors border border-transparent">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Users</h3>
          <p className="text-sm text-gray-600">
            View users, adjust credits, and manage roles
          </p>
        </Link>
        <div className="card bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Statistics</h3>
          <p className="text-sm text-gray-600">
            Detailed stats shown below
          </p>
        </div>
      </div>

      {/* Queue Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {stats.paid_queue_size}
              </div>
              <div className="text-sm text-gray-600">Paid Queue</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-purple-600">
                {stats.free_queue_size}
              </div>
              <div className="text-sm text-gray-600">Free Queue</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-blue-600">
                {stats.total_in_progress}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-green-600">
                {stats.total_completed}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Performance</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Pending</span>
                  <span className="font-semibold text-gray-900">{stats.total_pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Completed</span>
                  <span className="font-semibold text-gray-900">{stats.total_completed}</span>
                </div>
                {stats.avg_completion_days !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Avg. Completion Time</span>
                    <span className="font-semibold text-gray-900">
                      {stats.avg_completion_days.toFixed(1)} days
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Popular Series */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Popular Series</h2>
              {stats.popular_series.length === 0 ? (
                <p className="text-gray-600 text-sm">No completed submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.popular_series.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        {index + 1}. {item.series}
                      </span>
                      <span className="text-sm font-semibold text-blue-600">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
