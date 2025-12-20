import { jwtDecode } from "jwt-decode";

/**
 * Check if a token is valid and not expired
 * @param {string} token - Optional token to validate, defaults to stored accessToken
 */
export const isTokenValid = (token) => {
  // Try new token structure first, fallback to legacy token
  const tokenToValidate = token || localStorage.getItem("accessToken") || localStorage.getItem("token");
  if (!tokenToValidate) return false;

  try {
    const { exp } = jwtDecode(tokenToValidate);
    return Date.now() < exp * 1000;
  } catch (err) {
    console.error("Invalid token:", err);
    return false;
  }
};

/**
 * Logout user and clear all stored data
 */
export const logout = () => {
  // Clear new token structure
  localStorage.removeItem("accessToken");
  localStorage.removeItem("idToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userData");
  
  // Clear legacy tokens
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  
  window.location.href = "/login";
};
