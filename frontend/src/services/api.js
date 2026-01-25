import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else if (error.response?.status === 403) {
      // Forbidden - likely tier restriction
      const errorMessage =
        error.response?.data?.detail ||
        "Your subscription is required to access this site. Please renew your VAMA Patreon subscription.";
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = `/login?error=${encodeURIComponent(errorMessage)}`;
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: () => {
    window.location.href = `${API_URL}/api/auth/login`;
  },

  getCurrentUser: () => api.get("/api/auth/me"),

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return api.post("/api/auth/logout");
  },
};

// Users API
export const usersAPI = {
  getMe: () => api.get("/api/users/me"),

  getCreditHistory: (limit = 50) =>
    api.get("/api/users/me/credits/history", { params: { limit } }),
};

// Submissions API
export const submissionsAPI = {
  create: (formData) =>
    api.post("/api/submissions/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  uploadImages: (submissionId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return api.post(`/api/submissions/${submissionId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  deleteImage: (submissionId, imageId) =>
    api.delete(`/api/submissions/${submissionId}/images/${imageId}`),

  list: (status) => api.get("/api/submissions/", { params: { status } }),

  get: (id) => api.get(`/api/submissions/${id}`),

  update: (id, data) =>
    api.put(`/api/submissions/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  cancel: (id) => api.delete(`/api/submissions/${id}`),

  search: (query) =>
    api.get("/api/submissions/search/", { params: { q: query } }),

  autocompleteSeries: (query) =>
    api.get("/api/submissions/autocomplete/series", { params: { q: query } }),
};

// Queue API
export const queueAPI = {
  getPaidQueue: () => api.get("/api/queue/paid"),

  getFreeQueue: () => api.get("/api/queue/free"),

  vote: (submissionId) =>
    api.post("/api/queue/vote", { submission_id: submissionId }),

  removeVote: (submissionId) => api.delete(`/api/queue/vote/${submissionId}`),

  getVoteAllowance: () => api.get("/api/queue/vote/allowance"),

  getMyVotes: () => api.get("/api/queue/vote/my-votes"),
};

// Admin API
export const adminAPI = {
  listSubmissions: (status, queueType) =>
    api.get("/api/admin/submissions", {
      params: { status, queue_type: queueType },
    }),

  getSubmission: (id) => api.get(`/api/admin/submissions/${id}`),

  completeSubmission: (id, data) => api.post(`/api/admin/${id}/complete`, data),

  updateNotes: (id, notes) =>
    api.patch(`/api/admin/${id}/notes`, notes, {
      headers: { "Content-Type": "text/plain" },
    }),

  startSubmission: (id) => api.post(`/api/admin/${id}/start`),

  getStats: () => api.get("/api/admin/stats"),

  listUsers: () => api.get("/api/admin/users"),

  updateUserRole: (userId, role) =>
    api.patch(`/api/admin/users/${userId}/role`, role, {
      headers: { "Content-Type": "text/plain" },
    }),

  adjustCredits: (userId, amount, reason) =>
    api.post(`/api/admin/users/${userId}/credits`, { amount, reason }),
};

export default api;
