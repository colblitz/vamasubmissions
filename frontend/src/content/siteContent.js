/**
 * VAMA Community Tracker - Centralized Text Content
 * 
 * This file contains all text content used throughout the application,
 * organized by page/section for easy editing and maintenance.
 */

export const siteContent = {
  // ============================================================================
  // LOGIN PAGE
  // ============================================================================
  login: {
    // Main heading and description
    heading: "Character Submissions",
    description: "Login with your Patreon account to browse VAMA's posts",

    // Subscription error section (shown when user doesn't have required tier)
    subscriptionError: {
      title: "Subscription Required",
      ctaButton: "Subscribe on Patreon →",
      patreonUrl: "https://www.patreon.com/vama_art",
    },

    // Available subscription tiers
    tiers: [
      { name: "NSFW Art! Tier 1", price: "$5/month" },
      { name: "NSFW Art! Tier 2", price: "$15/month" },
      { name: "NSFW Art! Tier 3", price: "$30/month" },
      { name: "NSFW Art! Support", price: "$60/month" },
    ],

    // Privacy & Data Collection Information
    privacyInfo: {
      // Collapsible section heading
      toggleHeading: "What information is collected?",

      // OAuth Scopes section
      oauthScopes: {
        heading: "OAuth Scopes Requested",
        scopes: [
          {
            name: "identity",
            description: "Access your Patreon username",
          },
          {
            name: "identity.memberships",
            description: "Verify your subscription tier and patron status",
          },
        ],
      },

      // Data Storage section
      dataStorage: {
        heading: "Data Stored in Our Database",
        items: [
          "Patreon user ID (unique identifier)",
          "Patreon username (for display purposes)",
          "Subscription tier ID (to determine access level)",
          "Campaign ID (to verify VAMA subscription)",
          "Patron status (active, former, etc.)",
        ],
        note: "Note: We do NOT store your email address or any payment information.",
      },

      // Why Information Is Needed section
      whyNeeded: {
        heading: "Why This Information Is Needed",
        description:
          "This platform is exclusive to VAMA's Patreon subscribers. We need to verify your active subscription to grant access to:",
        features: [
          "Browse character posts and artwork",
          "Suggest and approve metadata edits",
          "Participate in community features",
        ],
      },

      // Privacy & Security section
      privacySecurity: {
        heading: "Privacy & Security",
        points: [
          {
            label: "No payment information",
            description: "is collected or stored",
          },
          {
            label: "No personal data",
            description: "beyond subscription status",
          },
          {
            label: "access control",
            description: "and platform features",
            prefix: "Your data is only used for",
          },
          {
            description: "Your subscription is checked with Patreon on each login",
          },
          {
            description: "You can revoke access anytime through your",
            link: {
              text: "Patreon settings",
              url: "https://www.patreon.com/settings/apps",
            },
          },
        ],
      },

      // Footer disclaimer
      disclaimer:
        "By logging in, you agree to share the above information with this platform for the purpose of subscription verification and access control.",
    },

    // Mock authentication (development mode)
    mockAuth: {
      banner: {
        title: "[DEVELOPMENT MODE]",
        description:
          "Mock authentication is enabled. Select a user type to login.",
      },
      selectLabel: "Select User Type",
      detailsHeading: "Selected User Details:",
      footer: "To use real Patreon OAuth, set VITE_USE_MOCK_AUTH=false in .env",
    },
  },

  // ============================================================================
  // ABOUT PAGE
  // ============================================================================
  about: {
    // Page heading
    heading: "About VAMA Community Tracker",

    // Welcome section
    welcome: {
      heading: "Welcome!",
      paragraphs: [
        "Welcome to the VAMA Posts Search Tool, an unofficial tool for searching and browsing VAMA's old posts. This site is an unofficial personal project and is not affiliated with or endorsed by VAMA. All character artwork and content belongs to VAMA.",
      ],
    },

    // How It Works section
    howItWorks: {
      heading: "How It Works",
      sections: [
        {
          title: "Searching",
          description:
            "Use the Search page to find posts by character name, series, or tags. You can also browse by category to discover new content.",
        },
        {
          title: "Suggesting Edits",
          description:
            'Found a typo or missing tag? Click "Suggest Edit" on any post to propose changes. Another community member will review and approve your suggestion.',
        },
        {
          title: "Reviewing Edits",
          description:
            "Visit the Review Edits page to see pending suggestions from other users. Help keep the database accurate by approving good edits!",
        },
      ],
    },

    // Roadmap section
    roadmap: {
      heading: "Coming Soon",
      items: [
        "View all post thumbnails",
        "Ability to search for non-existent values",
        "Make everything case insensitive",
        "Mobile UX improvements",
      ],
    },

    // Contact section
    contact: {
      heading: "Questions or Feedback?",
      text: "If you have any questions, suggestions, or run into any issues, feel free to contact colblitz on Discord.",
    },

    // Leaderboard section
    leaderboard: {
      topContributors: {
        heading: "Top Contributors (Edits Suggested)",
        emptyState: "No edit suggestions yet. Be the first!",
        editLabel: "edit",
        editsLabel: "edits",
      },
      topReviewers: {
        heading: "Top Reviewers (Edits Approved)",
        emptyState: "No edit approvals yet. Start reviewing!",
        approvalLabel: "approval",
        approvalsLabel: "approvals",
      },
      stats: {
        heading: "Community Stats",
        totalSuggested: "Total Edits Suggested",
        totalApproved: "Total Edits Approved",
      },
    },
  },

  // ============================================================================
  // COMMUNITY REQUESTS PAGE
  // ============================================================================
  communityRequests: {
    // Page heading
    heading: "Community Requests",

    // Important Notice disclaimer banner
    disclaimer: {
      heading: "Important Notice",
      text: "This is an unofficial community tracker for character requests. Not all users record their requests here, so the queue may not reflect the complete picture. This tool is meant to help the community coordinate and track what has been requested, but it is not managed or endorsed by VAMA.",
    },

    // Success messages
    successMessages: {
      requestSubmitted: "Request submitted successfully!",
      requestMarkedDone: "Request marked as done and removed from queue!",
    },

    // New Request Form
    newRequestForm: {
      heading: "Record a Request",
      fields: {
        characters: {
          label: "Characters (comma-separated)",
          placeholder: "e.g., Kafka, Himeko",
        },
        series: {
          label: "Series (comma-separated)",
          placeholder: "e.g., Honkai: Star Rail",
        },
        requestedDate: {
          label: "Requested Date",
          helpText: "When did you submit this request to VAMA?",
        },
        description: {
          label: "Description (optional)",
          placeholder: "Any additional details...",
        },
        isPrivate: {
          label: "Private Request",
          helpText:
            'Private requests will appear in the public queue, but the character and series details will be hidden from other users (shown as "[Private Request]"). Only you and admins can see the full details.',
        },
      },
      submitButton: "Record Request",
    },

    // My Requests section
    myRequests: {
      heading: "My Requests",
      statusLabels: {
        pending: "pending",
        fulfilled: "fulfilled",
      },
      queuePosition: "in queue",
      requestedOn: "Requested on:",
      notSpecified: "Not specified",
      viewFulfilledPost: "View fulfilled post →",
      markAsDoneButton: "Mark as Done",
      confirmationPrompt:
        "Mark this request as fulfilled? It will be removed from the queue.",
      confirmButton: "Yes, Mark as Done",
      cancelButton: "Cancel",
    },

    // Known Queue section
    knownQueue: {
      heading: "Known Queue",
      loading: "Loading...",
      requestedOn: "Requested on:",
      notSpecified: "Not specified",
    },

    // Empty state (when no requests exist)
    emptyState: {
      heading: "No Pending Requests",
      description:
        "The community queue is currently empty! Browse existing posts or search for characters to see what's already available.",
      browseButton: "Browse Posts",
      searchButton: "Search Posts",
    },
  },
};

export default siteContent;
