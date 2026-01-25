import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Header() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold">
            VAMA Posts
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center divide-x divide-gray-600">
                <Link
                  to="/about"
                  className="hover:text-blue-400 transition-colors px-4"
                >
                  About
                </Link>
                <Link
                  to="/search"
                  className="hover:text-blue-400 transition-colors px-4"
                >
                  Search
                </Link>
                <Link
                  to="/review"
                  className="hover:text-blue-400 transition-colors px-4"
                >
                  Review Edits
                </Link>
                <Link
                  to="/requests"
                  className="hover:text-blue-400 transition-colors px-4"
                >
                  Requests
                </Link>
                {isAdmin() && (
                  <Link
                    to="/admin/import"
                    className="hover:text-yellow-400 transition-colors px-4"
                  >
                    Import Posts
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-4 border-l border-gray-600 pl-4">
                <div className="text-sm">
                  <div className="font-semibold">{user.patreon_username}</div>
                  <div className="text-gray-400">
                    {user.tier_name || "Free Tier"}
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
