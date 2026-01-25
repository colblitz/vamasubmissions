import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { mockAuth } from "../services/mockAuth";

export default function LoginPage() {
  const { login, isMockAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedUser, setSelectedUser] = useState("tier2");
  const [error, setError] = useState(null);

  // Check for error in URL params (from OAuth callback or tier restriction)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleLogin = async () => {
    try {
      setError(null);
      await login(selectedUser);
      navigate("/search");
    } catch (error) {
      console.error("Login failed:", error);
      setError("Login failed. Please try again.");
    }
  };

  if (!isMockAuth) {
    // Real Patreon OAuth
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="card max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-6">Character Submissions</h1>

          {error && (
            <div className="bg-red-50 border-2 border-red-500 text-red-900 px-6 py-4 rounded-lg mb-6 text-left">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-bold text-lg mb-2">
                    Subscription Required
                  </p>
                  <p className="text-sm mb-3">{error}</p>
                  <a
                    href="https://www.patreon.com/vama_art"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded transition-colors"
                  >
                    Subscribe on Patreon →
                  </a>
                  <div className="mt-3 text-xs text-red-700">
                    <p className="font-semibold mb-1">Available tiers:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>NSFW Art! Tier 1 ($5/month)</li>
                      <li>NSFW Art! Tier 2 ($15/month)</li>
                      <li>NSFW Art! Tier 3 ($30/month)</li>
                      <li>NSFW Art! Support ($60/month)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

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
          <p className="text-sm">
            Mock authentication is enabled. Select a user type to login.
          </p>
        </div>

        <h1 className="text-3xl font-bold mb-6 text-center">
          Character Submissions
        </h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User Type
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
              {mockUsers.map((userType) => {
                const user = mockAuth.getMockUser(userType);
                return (
                  <option
                    key={userType}
                    value={userType}
                    className="text-gray-900"
                  >
                    {user.patreon_username} (Tier {user.tier}, {user.role})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
            <h3 className="font-semibold mb-2 text-gray-900">
              Selected User Details:
            </h3>
            {(() => {
              const user = mockAuth.getMockUser(selectedUser);
              return (
                <div className="text-sm space-y-1 text-gray-700">
                  <p>
                    <span className="font-medium text-gray-900">Username:</span>{" "}
                    {user.patreon_username}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Tier:</span>{" "}
                    {user.tier}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Role:</span>{" "}
                    {user.role}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Credits:</span>{" "}
                    {user.credits} / {user.max_credits}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">
                      Can Submit Multiple:
                    </span>{" "}
                    {user.can_submit_multiple ? "Yes" : "No"}
                  </p>
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
