import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useVisibilityPolling } from "../hooks/usePolling";
import { useAuth } from "./AuthContext";

const RealTimeContext = createContext();

export const useRealTime = () => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error("useRealTime must be used within a RealTimeProvider");
  }
  return context;
};

export const RealTimeProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time data states
  const [liveMatches, setLiveMatches] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);

  // Polling intervals (in milliseconds)
  const INTERVALS = {
    MATCHES: 15000, // 15 seconds for live matches
    LEADERBOARD: 30000, // 30 seconds for leaderboard
    NOTIFICATIONS: 20000, // 20 seconds for notifications
    ADMIN_STATS: 60000, // 1 minute for admin stats
    ACTIVITY: 45000, // 45 seconds for recent activity
  };

  // Fetch functions
  const fetchLiveMatches = useCallback(async () => {
    if (!isAuthenticated) return [];

    const response = await fetch(
      "http://localhost:5000/api/matches?status=in_progress",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error("Failed to fetch live matches");
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return [];

    const response = await fetch("http://localhost:5000/api/users/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error("Failed to fetch notifications");
  }, [isAuthenticated]);

  const fetchPendingVerifications = useCallback(async () => {
    if (!isAuthenticated || user?.role !== "admin") return [];

    const response = await fetch(
      "http://localhost:5000/api/admin/matches/pending",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error("Failed to fetch pending verifications");
  }, [isAuthenticated, user?.role]);

  const fetchSystemStats = useCallback(async () => {
    if (!isAuthenticated || user?.role !== "admin") return {};

    const response = await fetch("http://localhost:5000/api/admin/stats", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error("Failed to fetch system stats");
  }, [isAuthenticated, user?.role]);

  const fetchRecentActivity = useCallback(async () => {
    if (!isAuthenticated) return [];

    const response = await fetch(
      "http://localhost:5000/api/admin/audit-logs?limit=10",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error("Failed to fetch recent activity");
  }, [isAuthenticated]);

  // Polling hooks
  const {
    data: liveMatchesData,
    lastUpdated: matchesLastUpdated,
    error: matchesError,
  } = useVisibilityPolling(fetchLiveMatches, INTERVALS.MATCHES, {
    enabled: isAuthenticated,
    onSuccess: (data) => setLiveMatches(data || []),
    onError: (error) => console.error("Live matches polling error:", error),
  });

  const {
    data: notificationsData,
    lastUpdated: notificationsLastUpdated,
    error: notificationsError,
  } = useVisibilityPolling(fetchNotifications, INTERVALS.NOTIFICATIONS, {
    enabled: isAuthenticated,
    onSuccess: (data) => {
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.read).length || 0);
    },
    onError: (error) => console.error("Notifications polling error:", error),
  });

  const {
    data: pendingVerificationsData,
    lastUpdated: verificationsLastUpdated,
    error: verificationsError,
  } = useVisibilityPolling(fetchPendingVerifications, INTERVALS.ADMIN_STATS, {
    enabled: isAuthenticated && user?.role === "admin",
    onSuccess: (data) => setPendingVerifications(data || []),
    onError: (error) =>
      console.error("Pending verifications polling error:", error),
  });

  const {
    data: systemStatsData,
    lastUpdated: statsLastUpdated,
    error: statsError,
  } = useVisibilityPolling(fetchSystemStats, INTERVALS.ADMIN_STATS, {
    enabled: isAuthenticated && user?.role === "admin",
    onSuccess: (data) => setSystemStats(data || {}),
    onError: (error) => console.error("System stats polling error:", error),
  });

  const {
    data: recentActivityData,
    lastUpdated: activityLastUpdated,
    error: activityError,
  } = useVisibilityPolling(fetchRecentActivity, INTERVALS.ACTIVITY, {
    enabled: isAuthenticated && user?.role === "admin",
    onSuccess: (data) => setRecentActivity(data || []),
    onError: (error) => console.error("Recent activity polling error:", error),
  });

  // Notification management
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/users/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/users/notifications/read-all",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, []);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState("connected");

  useEffect(() => {
    const handleOnline = () => setConnectionStatus("connected");
    const handleOffline = () => setConnectionStatus("disconnected");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check for errors and update connection status
  useEffect(() => {
    const hasErrors =
      matchesError ||
      notificationsError ||
      verificationsError ||
      statsError ||
      activityError;

    if (hasErrors && connectionStatus === "connected") {
      setConnectionStatus("error");
    } else if (!hasErrors && connectionStatus === "error") {
      setConnectionStatus("connected");
    }
  }, [
    matchesError,
    notificationsError,
    verificationsError,
    statsError,
    activityError,
    connectionStatus,
  ]);

  // Real-time event simulation (in a real app, this would be WebSocket events)
  const simulateRealTimeEvent = useCallback(
    (eventType, data) => {
      switch (eventType) {
        case "match_score_updated":
          addNotification({
            type: "info",
            title: "Match Score Updated",
            message: `${data.team1} vs ${data.team2} - Score: ${data.score1}-${data.score2}`,
          });
          break;

        case "tournament_started":
          addNotification({
            type: "success",
            title: "Tournament Started",
            message: `${data.tournamentName} has begun!`,
          });
          break;

        case "team_invitation":
          addNotification({
            type: "info",
            title: "Team Invitation",
            message: `You've been invited to join ${data.teamName}`,
          });
          break;

        case "match_verification_needed":
          if (user?.role === "admin") {
            addNotification({
              type: "warning",
              title: "Match Verification Required",
              message: `Match between ${data.team1} and ${data.team2} needs verification`,
            });
          }
          break;

        default:
          break;
      }
    },
    [addNotification, user?.role]
  );

  const value = {
    // Data
    liveMatches,
    notifications,
    unreadCount,
    pendingVerifications,
    systemStats,
    recentActivity,

    // Status
    connectionStatus,
    lastUpdated: {
      matches: matchesLastUpdated,
      notifications: notificationsLastUpdated,
      verifications: verificationsLastUpdated,
      stats: statsLastUpdated,
      activity: activityLastUpdated,
    },

    // Actions
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    simulateRealTimeEvent,

    // Polling intervals for reference
    intervals: INTERVALS,
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};

export default RealTimeProvider;
