import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">
            Character Submissions
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="hover:text-blue-400 transition-colors">
                  Home
                </Link>
                {user.tier > 1 && (
                  <Link to="/requests" className="hover:text-blue-400 transition-colors">
                    Queue
                  </Link>
                )}
                <Link to="/votes" className="hover:text-blue-400 transition-colors">
                  Votes
                </Link>
                {isAdmin() && (
                  <Link to="/admin" className="hover:text-blue-400 transition-colors">
                    Admin
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-4 border-l border-gray-600 pl-4">
                <div className="text-sm">
                  <div className="font-semibold">{user.patreon_username}</div>
                  <div className="text-gray-400">
                    Tier {user.tier} {user.tier > 1 && `• ${user.credits} credits`}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-sm hover:text-red-400 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="btn-primary">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
