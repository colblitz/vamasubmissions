import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { submissionsAPI } from '../services/api';

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubmission();
  }, [id]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const response = await submissionsAPI.get(id);
      setSubmission(response.data);
    } catch (error) {
      console.error('Failed to load submission:', error);
      alert('Failed to load submission');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this submission? Your credits will be refunded.')) {
      return;
    }

    try {
      setCancelling(true);
      await submissionsAPI.cancel(id);
      alert('Submission cancelled successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to cancel submission:', error);
      alert(error.response?.data?.detail || 'Failed to cancel submission');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading submission...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="card text-center">
        <p className="text-red-600 font-semibold">[ERROR] Submission not found</p>
        <Link to="/dashboard" className="btn-primary mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isOwner = submission.user_id === user.id;
  const canView = isOwner || isAdmin() || submission.is_public;

  if (!canView) {
    return (
      <div className="card text-center">
        <p className="text-red-600 font-semibold">[ERROR] You don't have permission to view this submission</p>
        <Link to="/dashboard" className="btn-primary mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{submission.character_name}</h1>
              <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusBadge(submission.status)}`}>
                {submission.status.replace('_', ' ').toUpperCase()}
              </span>
              {submission.is_public && (
                <span className="px-3 py-1 rounded text-sm font-semibold bg-purple-100 text-purple-800">
                  PUBLIC
                </span>
              )}
            </div>
            <p className="text-lg text-gray-600">
              {submission.series}
            </p>
          </div>
          
          {isOwner && submission.status === 'pending' && (
            <div className="flex gap-2">
              <Link
                to={`/submission/${submission.id}/edit`}
                className="btn-secondary"
              >
                Edit
              </Link>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="btn-danger"
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Submitted</p>
            <p className="font-semibold text-gray-900">{new Date(submission.submitted_at).toLocaleDateString()}</p>
          </div>
          {submission.queue_position && (
            <div>
              <p className="text-gray-500">Queue Position</p>
              <p className="font-semibold text-gray-900">#{submission.queue_position}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Queue Type</p>
            <p className="font-semibold text-gray-900">{submission.queue_type === 'paid' ? 'Paid' : 'Free'}</p>
          </div>
          <div>
            <p className="text-gray-500">Credit Cost</p>
            <p className="font-semibold text-gray-900">{submission.credit_cost}</p>
          </div>
        </div>

        {submission.estimated_completion_date && submission.status === 'pending' && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Estimated Completion:</span>{' '}
              {new Date(submission.estimated_completion_date).toLocaleDateString()}
              <span className="text-xs ml-2">(estimate only)</span>
            </p>
          </div>
        )}

        {submission.status === 'completed' && submission.patreon_post_url && (
          <div className="mt-4">
            <a
              href={submission.patreon_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-block"
            >
              View Patreon Post →
            </a>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Description</h2>
        <p className="text-gray-700 whitespace-pre-wrap">
          {submission.description}
        </p>
      </div>

      {/* Request Modifiers */}
      {(submission.is_large_image_set || submission.is_double_character) && (
        <div className="card">
          <h2 className="text-xl font-bold mb-3">Request Modifiers</h2>
          <div className="flex gap-2">
            {submission.is_large_image_set && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold">
                Large Image Set (+1 credit)
              </span>
            )}
            {submission.is_double_character && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-semibold">
                Double Character (+1 credit)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Images */}
      {submission.images && submission.images.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-3">Reference Images ({submission.images.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {submission.images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={`http://localhost:8000${image.file_path}`}
                  alt={`Reference ${image.upload_order + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                  <a
                    href={`http://localhost:8000${image.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    View Full Size
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Timeline</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <div>
              <p className="font-semibold text-gray-900">Submitted</p>
              <p className="text-sm text-gray-600">
                {new Date(submission.submitted_at).toLocaleString()}
              </p>
            </div>
          </div>
          
          {submission.workflow_started_at && (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
              <div>
                <p className="font-semibold text-gray-900">Started</p>
                <p className="text-sm text-gray-600">
                  {new Date(submission.workflow_started_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          
          {submission.completed_at && (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <div>
                <p className="font-semibold text-gray-900">Completed</p>
                <p className="text-sm text-gray-600">
                  {new Date(submission.completed_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Notes */}
      {isAdmin() && submission.admin_notes && (
        <div className="card bg-yellow-50 border border-yellow-200">
          <h2 className="text-xl font-bold mb-3 text-yellow-900">
            Admin Notes (Admin Only)
          </h2>
          <p className="text-yellow-800 whitespace-pre-wrap">
            {submission.admin_notes}
          </p>
        </div>
      )}

      {/* Back Button */}
      <div className="text-center">
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
