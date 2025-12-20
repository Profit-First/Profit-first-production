import axios from 'axios';
import { isTokenValid, logout } from "./src/utils/auth";

const axiosInstance = axios.create({
  // baseURL: 'http://localhost:3000/api',
  baseURL: '/api',
  // baseURL: 'https://profitfirst.co.in/api',
});

axiosInstance.interceptors.request.use((config) => {
  // Try new token structure first, fallback to legacy token
  const accessToken = localStorage.getItem("accessToken");
  const legacyToken = localStorage.getItem("token");
  const token = accessToken || legacyToken;
  
  if (token) {
    if (!isTokenValid(token)) {
      logout(); // auto-logout if token expired
      return Promise.reject({ message: "Token expired" });
    }
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh-token', {
            refreshToken,
          });

          const { accessToken, idToken } = response.data.tokens;
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("idToken", idToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
