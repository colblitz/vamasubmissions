import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("No token received from authentication");
      return;
    }

    const processCallback = async () => {
      try {
        await handleOAuthCallback(token);
        navigate("/dashboard");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError("Failed to complete authentication");
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="card max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">[ERROR]</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Failed</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate("/login")} className="btn-primary">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="card max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Completing Authentication</h2>
        <p className="text-gray-600 dark:text-gray-400">Please wait...</p>
      </div>
    </div>
  );
}
