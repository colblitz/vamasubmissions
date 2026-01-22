/**
 * Mock authentication service for development without Patreon OAuth
 *
 * This allows testing the frontend before Patreon integration is set up.
 * To use real Patreon OAuth, set VITE_USE_MOCK_AUTH=false in .env
 */

const MOCK_USERS = {
  tier1: {
    id: 1,
    patreon_id: "mock_tier1",
    patreon_username: "NSFW Art! Tier 1",
    email: "tier1@example.com",
    tier: 1,
    credits: 0,
    max_credits: 0,
    credits_per_month: 0,
    role: "patron",
    can_submit_multiple: false,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
  tier2: {
    id: 2,
    patreon_id: "mock_tier2",
    patreon_username: "NSFW Art! Tier 2",
    email: "tier2@example.com",
    tier: 2,
    credits: 2,
    max_credits: 2,
    credits_per_month: 1,
    role: "patron",
    can_submit_multiple: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
  tier3: {
    id: 3,
    patreon_id: "mock_tier3",
    patreon_username: "NSFW Art! Tier 3",
    email: "tier3@example.com",
    tier: 3,
    credits: 4,
    max_credits: 4,
    credits_per_month: 2,
    role: "patron",
    can_submit_multiple: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
  tier4: {
    id: 4,
    patreon_id: "mock_tier4",
    patreon_username: "NSFW Art! support ^^",
    email: "tier4@example.com",
    tier: 4,
    credits: 8,
    max_credits: 8,
    credits_per_month: 4,
    role: "patron",
    can_submit_multiple: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
  admin: {
    id: 5,
    patreon_id: "mock_admin",
    patreon_username: "AdminUser",
    email: "admin@example.com",
    tier: 4,
    credits: 8,
    max_credits: 8,
    credits_per_month: 4,
    role: "admin",
    can_submit_multiple: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
  creator: {
    id: 6,
    patreon_id: "mock_creator",
    patreon_username: "CreatorUser",
    email: "creator@example.com",
    tier: 4,
    credits: 8,
    max_credits: 8,
    credits_per_month: 4,
    role: "creator",
    can_submit_multiple: true,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  },
};

// Generate a mock JWT token
function generateMockToken(user) {
  const payload = {
    user_id: user.id,
    patreon_id: user.patreon_id,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };
  // In real app, this would be a proper JWT. For mock, just base64 encode
  return btoa(JSON.stringify(payload));
}

export const mockAuth = {
  /**
   * Mock login - select a user type
   */
  login(userType = "tier2") {
    const user = MOCK_USERS[userType];
    if (!user) {
      throw new Error(`Unknown user type: ${userType}`);
    }

    const token = generateMockToken(user);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    return { user, token };
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem("token");
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  /**
   * Get available mock user types
   */
  getAvailableUsers() {
    return Object.keys(MOCK_USERS);
  },

  /**
   * Get mock user details
   */
  getMockUser(userType) {
    return MOCK_USERS[userType];
  },
};

export const useMockAuth = () => {
  const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH === "true";
  return USE_MOCK;
};
