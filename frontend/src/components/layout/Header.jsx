import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function Header() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close menu on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className={`text-2xl font-bold transition-colors ${
              location.pathname === '/' ? 'text-blue-400' : 'hover:text-blue-400'
            }`}
          >
            VAMA Posts
          </Link>

          {isAuthenticated ? (
            <>
              {/* Desktop Navigation - Hidden on mobile */}
              <div className="hidden md:flex items-center gap-6">
                <div className="flex items-center divide-x divide-gray-600">
                  <Link
                    to="/about"
                    className={`hover:text-blue-400 transition-colors px-4 py-3 min-h-[44px] flex items-center ${
                      location.pathname === '/about' ? 'text-blue-400 bg-gray-700 rounded' : ''
                    }`}
                  >
                    About
                  </Link>
                  <Link
                    to="/search"
                    className={`hover:text-blue-400 transition-colors px-4 py-3 min-h-[44px] flex items-center ${
                      location.pathname === '/search' ? 'text-blue-400 bg-gray-700 rounded' : ''
                    }`}
                  >
                    Search
                  </Link>
                  <Link
                    to="/review"
                    className={`hover:text-blue-400 transition-colors px-4 py-3 min-h-[44px] flex items-center ${
                      location.pathname === '/review' ? 'text-blue-400 bg-gray-700 rounded' : ''
                    }`}
                  >
                    Review Edits
                  </Link>
                  {isAdmin() && (
                    <Link
                      to="/admin/import"
                      className={`hover:text-yellow-400 transition-colors px-4 py-3 min-h-[44px] flex items-center ${
                        location.pathname === '/admin/import' ? 'text-yellow-400 bg-gray-700 rounded' : ''
                      }`}
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
                    className="text-sm hover:text-red-400 transition-colors py-3 px-4 min-h-[44px]"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Mobile Navigation - Hamburger Icon and User Avatar */}
              <div className="flex md:hidden items-center gap-4">
                {/* User Avatar (mobile only) */}
                <div className="text-sm">
                  <div className="font-semibold text-xs">{user.patreon_username}</div>
                </div>
                
                {/* Hamburger Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="text-white hover:text-blue-400 transition-colors p-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Open menu"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16"></path>
                  </svg>
                </button>
              </div>

              {/* Mobile Menu Overlay */}
              {isMobileMenuOpen && (
                <>
                  {/* Dark Overlay */}
                  <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={closeMobileMenu}
                  ></div>

                  {/* Slide-in Menu */}
                  <div
                    className={`fixed top-0 right-0 h-full w-80 bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 md:hidden ${
                      isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Close Button */}
                    <div className="flex justify-end p-4">
                      <button
                        onClick={closeMobileMenu}
                        className="text-white hover:text-red-400 transition-colors p-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Close menu"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>

                    {/* User Info Section */}
                    <div className="px-6 py-4 border-b border-gray-700">
                      <div className="text-lg font-semibold">{user.patreon_username}</div>
                      <div className="text-sm text-gray-400">
                        {user.tier_name || "Free Tier"}
                      </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex flex-col py-4">
                      <Link
                        to="/about"
                        className={`px-6 py-3 hover:bg-gray-700 hover:text-blue-400 transition-colors min-h-[44px] flex items-center ${
                          location.pathname === '/about' ? 'bg-gray-700 text-blue-400 border-l-4 border-blue-400' : ''
                        }`}
                        onClick={closeMobileMenu}
                      >
                        About
                      </Link>
                      <Link
                        to="/search"
                        className={`px-6 py-3 hover:bg-gray-700 hover:text-blue-400 transition-colors min-h-[44px] flex items-center ${
                          location.pathname === '/search' ? 'bg-gray-700 text-blue-400 border-l-4 border-blue-400' : ''
                        }`}
                        onClick={closeMobileMenu}
                      >
                        Search
                      </Link>
                      <Link
                        to="/review"
                        className={`px-6 py-3 hover:bg-gray-700 hover:text-blue-400 transition-colors min-h-[44px] flex items-center ${
                          location.pathname === '/review' ? 'bg-gray-700 text-blue-400 border-l-4 border-blue-400' : ''
                        }`}
                        onClick={closeMobileMenu}
                      >
                        Review Edits
                      </Link>
                      {isAdmin() && (
                        <Link
                          to="/admin/import"
                          className={`px-6 py-3 hover:bg-gray-700 hover:text-yellow-400 transition-colors min-h-[44px] flex items-center ${
                            location.pathname === '/admin/import' ? 'bg-gray-700 text-yellow-400 border-l-4 border-yellow-400' : ''
                          }`}
                          onClick={closeMobileMenu}
                        >
                          Import Posts
                        </Link>
                      )}
                    </div>

                    {/* Logout Button */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-700">
                      <button
                        onClick={() => {
                          closeMobileMenu();
                          logout();
                        }}
                        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 rounded transition-colors text-center"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
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
