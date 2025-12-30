import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function VotesPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/votes/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setSessions(data.sessions);
      
      // Auto-select the first open session
      const openSession = data.sessions.find(s => s.status === 'open');
      if (openSession) {
        loadSession(openSession.id);
      }
    } catch (error) {
      console.error('Failed to load vote sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await fetch(`http://localhost:8000/api/votes/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setActiveSession(data);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleVote = async (submissionId) => {
    if (!activeSession) return;
    
    // Find if user has already voted on a different submission
    const currentVote = activeSession.submissions.find(s => s.user_has_voted);
    
    // If clicking the same submission they already voted for, REMOVE the vote
    if (currentVote && currentVote.id === submissionId) {
      // Optimistically remove vote
      setActiveSession(prev => ({
        ...prev,
        submissions: prev.submissions.map(s => {
          if (s.id === submissionId) {
            return { ...s, user_has_voted: false, vote_count: s.vote_count - 1 };
          }
          return s;
        })
      }));
      
      try {
        await fetch(
          `http://localhost:8000/api/votes/sessions/${activeSession.id}/submissions/${submissionId}/vote`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
      } catch (error) {
        console.error('Failed to remove vote:', error);
        // Revert on error
        await loadSession(activeSession.id);
      }
      return;
    }
    
    // Optimistically update UI without re-sorting
    setActiveSession(prev => ({
      ...prev,
      submissions: prev.submissions.map(s => {
        if (s.id === submissionId) {
          return { ...s, user_has_voted: true, vote_count: s.vote_count + 1 };
        }
        if (s.id === currentVote?.id) {
          return { ...s, user_has_voted: false, vote_count: s.vote_count - 1 };
        }
        return s;
      })
    }));
    
    try {
      // If user already voted on a different submission, remove that vote first
      if (currentVote && currentVote.id !== submissionId) {
        await fetch(
          `http://localhost:8000/api/votes/sessions/${activeSession.id}/submissions/${currentVote.id}/vote`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
      }
      
      // Add vote to the new submission
      const response = await fetch(
        `http://localhost:8000/api/votes/sessions/${activeSession.id}/submissions/${submissionId}/vote`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.detail || 'Failed to vote');
        // Revert optimistic update on error
        await loadSession(activeSession.id);
        return;
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to vote');
      // Revert optimistic update on error
      await loadSession(activeSession.id);
    }
  };

  const renderSubmission = (submission, index) => {
    const rank = index + 1;
    
    return (
      <div
        key={submission.id}
        onClick={() => handleVote(submission.id)}
        className={`border rounded-lg p-4 cursor-pointer transition-all ${
          submission.user_has_voted
            ? 'bg-purple-50 border-purple-500 border-2'
            : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-25'
        }`}
      >
        <div className="flex items-start gap-4">
          {/* Radio button indicator */}
          <div className="flex-shrink-0 mt-1">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              submission.user_has_voted
                ? 'border-purple-600 bg-purple-600'
                : 'border-gray-300 bg-white'
            }`}>
              {submission.user_has_voted && (
                <div className="w-2 h-2 rounded-full bg-white"></div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold text-gray-400">#{rank}</span>
              <h3 className="text-lg font-semibold text-gray-900">
                {submission.character_name}
              </h3>
              <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                {submission.vote_count} vote{submission.vote_count !== 1 ? 's' : ''}
              </span>
            </div>
            
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium text-gray-900">Series:</span> {submission.series}
            </p>
            
            <p className="text-sm text-gray-600">{submission.description}</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  const openSessions = sessions.filter(s => s.status === 'open');
  const closedSessions = sessions.filter(s => s.status === 'closed');

  // Check if user has already voted in the active session
  const userHasVoted = activeSession?.submissions.some(s => s.user_has_voted);

  return (
    <div className="space-y-6">
      {openSessions.length === 0 ? (
        <div className="card">
          <p className="text-center text-gray-600 py-8">
            No active vote sessions at the moment. Check back later!
          </p>
        </div>
      ) : (
        <>
          {openSessions.map(session => (
            <div key={session.id} className="card">
              <div className="mb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{session.title}</h2>
                    <p className="text-gray-600">{session.description}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-sm font-semibold bg-green-100 text-green-800">
                    OPEN
                  </span>
                </div>
                
                {session.closes_at && (
                  <p className="text-sm text-gray-500">
                    Closes: {new Date(session.closes_at).toLocaleDateString()} at {new Date(session.closes_at).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {activeSession?.id === session.id && activeSession.submissions.length > 0 ? (
                <div className="space-y-4">
                  {activeSession.submissions.map((submission, index) => renderSubmission(submission, index))}
                </div>
              ) : (
                <button
                  onClick={() => loadSession(session.id)}
                  className="btn-primary"
                >
                  View Submissions
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {closedSessions.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Past Votes</h2>
          <div className="space-y-2">
            {closedSessions.map(session => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-900">{session.title}</h3>
                  <p className="text-sm text-gray-600">
                    Closed: {new Date(session.closed_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="px-3 py-1 rounded text-sm font-semibold bg-gray-200 text-gray-700">
                  CLOSED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
