import axios from "axios";
import { createContext, useContext, useEffect, useReducer } from "react";
import { toast } from "react-toastify";

// Initial state
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  loading: true,
  isAuthenticated: false,
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: "LOGIN_START",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  LOGOUT: "LOGOUT",
  REFRESH_TOKEN: "REFRESH_TOKEN",
  SET_LOADING: "SET_LOADING",
  UPDATE_USER: "UPDATE_USER",
};

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        loading: false,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        loading: false,
      };

    case AUTH_ACTIONS.REFRESH_TOKEN:
      return {
        ...state,
        token: action.payload.token,
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Configure axios defaults
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, [state.token]);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const refreshToken = localStorage.getItem("refreshToken");

      if (token) {
        try {
          // Verify token by getting user profile
          const response = await axios.get("http://localhost:5000/api/auth/me");

          dispatch({
            type: AUTH_ACTIONS.LOGIN_SUCCESS,
            payload: {
              user: response.data.user,
              token,
              refreshToken,
            },
          });
        } catch (error) {
          // Token is invalid, try to refresh
          if (refreshToken) {
            try {
              await refreshAccessToken();
            } catch (refreshError) {
              // Refresh failed, logout
              logout();
            }
          } else {
            logout();
          }
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await axios.post(
        "http://localhost:5000/api/auth/login-simple",
        {
          email,
          password,
        }
      );

      const { user, tokens } = response.data;
      const { access_token, refresh_token } = tokens;

      // Store tokens
      localStorage.setItem("token", access_token);
      localStorage.setItem("refreshToken", refresh_token);

      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user,
          token: access_token,
          refreshToken: refresh_token,
        },
      });

      toast.success("Login successful!");
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });

      const errorMessage = error.response?.data?.error || "Login failed";
      toast.error(errorMessage);

      return {
        success: false,
        error: errorMessage,
        code: error.response?.data?.code,
      };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await axios.post(
        "http://localhost:5000/api/auth/register",
        userData
      );

      toast.success("Registration successful! Please login.");
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });

      return { success: true, data: response.data };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });

      const errorMessage = error.response?.data?.error || "Registration failed";
      toast.error(errorMessage);

      return {
        success: false,
        error: errorMessage,
        code: error.response?.data?.code,
        details: error.response?.data?.details,
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint if authenticated
      if (state.token) {
        await axios.post("http://localhost:5000/api/auth/logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local storage
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");

      // Clear axios default header
      delete axios.defaults.headers.common["Authorization"];

      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.info("Logged out successfully");
    }
  };

  // Refresh token function
  const refreshAccessToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await axios.post(
        "http://localhost:5000/api/auth/refresh",
        {
          refresh_token: refreshToken,
        }
      );

      const { access_token } = response.data;

      // Update stored token
      localStorage.setItem("token", access_token);

      // Update axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN,
        payload: { token: access_token },
      });

      return access_token;
    } catch (error) {
      // Refresh failed, logout user
      logout();
      throw error;
    }
  };

  // Update user profile
  const updateUser = (userData) => {
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: userData,
    });
  };

  // Axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          error.response?.data?.code === "TOKEN_EXPIRED" &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          try {
            const newToken = await refreshAccessToken();
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(state.user?.role);
  };

  // Context value
  const value = {
    ...state,
    login,
    register,
    logout,
    refreshAccessToken,
    updateUser,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export default AuthContext;
