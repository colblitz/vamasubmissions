import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mockAuth } from '../services/mockAuth';

export default function LoginPage() {
  const { login, isMockAuth } = useAuth();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState('tier2');
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await login(selectedUser);
      navigate('/search');
    } catch (error) {
      console.error('Login failed:', error);
      setError('Login failed. Please try again.');
    }
  };

  if (!isMockAuth) {
    // Real Patreon OAuth
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="card max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-6">Character Submissions</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Login with your Patreon account to submit character requests
          </p>
          <button onClick={handleLogin} className="btn-primary w-full">
            Login with Patreon
          </button>
        </div>
      </div>
    );
  }

  // Mock authentication UI
  const mockUsers = mockAuth.getAvailableUsers();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="card max-w-md w-full">
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded mb-6">
          <p className="font-semibold">[DEVELOPMENT MODE]</p>
          <p className="text-sm">Mock authentication is enabled. Select a user type to login.</p>
        </div>

        <h1 className="text-3xl font-bold mb-6 text-center">Character Submissions</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select User Type</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
              {mockUsers.map((userType) => {
                const user = mockAuth.getMockUser(userType);
                return (
                  <option key={userType} value={userType} className="text-gray-900">
                    {user.patreon_username} (Tier {user.tier}, {user.role})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-900">Selected User Details:</h3>
            {(() => {
              const user = mockAuth.getMockUser(selectedUser);
              return (
                <div className="text-sm space-y-1 text-gray-700">
                  <p><span className="font-medium text-gray-900">Username:</span> {user.patreon_username}</p>
                  <p><span className="font-medium text-gray-900">Tier:</span> {user.tier}</p>
                  <p><span className="font-medium text-gray-900">Role:</span> {user.role}</p>
                  <p><span className="font-medium text-gray-900">Credits:</span> {user.credits} / {user.max_credits}</p>
                  <p><span className="font-medium text-gray-900">Can Submit Multiple:</span> {user.can_submit_multiple ? 'Yes' : 'No'}</p>
                </div>
              );
            })()}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

          <button onClick={handleLogin} className="btn-primary w-full">
            Login as {mockAuth.getMockUser(selectedUser).patreon_username}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>To use real Patreon OAuth, set VITE_USE_MOCK_AUTH=false in .env</p>
        </div>
      </div>
    </div>
  );
}
