import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { mockAuth, useMockAuth } from "../services/mockAuth";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMockAuth = useMockAuth();

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      if (isMockAuth) {
        // Use mock auth - get user from localStorage
        const mockUser = mockAuth.getCurrentUser();
        if (mockUser) {
          setUser(mockUser);
        } else {
          // Token exists but no user - clear and redirect
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
        setLoading(false);
      } else {
        // Use real API
        try {
          const response = await authAPI.getCurrentUser();
          setUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        } catch (error) {
          console.error("Failed to get current user:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        } finally {
          setLoading(false);
        }
      }
    };

    initAuth();
  }, [isMockAuth]);

  const login = async (userType = "tier2") => {
    if (isMockAuth) {
      // Call the real backend's mock login endpoint
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/login?username=${userType}`,
          {
            method: "GET",
          },
        );

        if (!response.ok) {
          // Check for 403 (tier restriction)
          if (response.status === 403) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Access denied");
          }
          throw new Error("Mock login failed");
        }

        const data = await response.json();

        // Store the real JWT token from backend
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);

        return data.user;
      } catch (error) {
        console.error("Mock login error:", error);
        throw error;
      }
    } else {
      // Real Patreon OAuth - redirect to backend
      authAPI.login();
    }
  };

  const logout = async () => {
    if (isMockAuth) {
      mockAuth.logout();
    } else {
      try {
        await authAPI.logout();
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    setUser(null);
  };

  const handleOAuthCallback = async (token) => {
    // Called after Patreon OAuth redirect
    localStorage.setItem("token", token);

    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error("Failed to get user after OAuth:", error);
      throw error;
    }
  };

  const isAdmin = () => {
    return user?.role === "admin" || user?.role === "creator";
  };

  const isCreator = () => {
    return user?.role === "creator";
  };

  const value = {
    user,
    loading,
    login,
    logout,
    handleOAuthCallback,
    isAuthenticated: !!user,
    isAdmin,
    isCreator,
    isMockAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
