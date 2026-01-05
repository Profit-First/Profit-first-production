/**
 * Premium Toast Notification System
 * User-friendly messages with auto-dismiss and beautiful styling
 */

import { toast as reactToast, Slide } from 'react-toastify';

// Default configuration for all toasts
const defaultConfig = {
  position: "top-right",
  autoClose: 2000, // 2 seconds - readable time
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "dark",
  transition: Slide, // Use proper React component
  style: {
    background: '#1a1a1a',
    color: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '14px',
    fontWeight: '500',
    minHeight: '64px',
    padding: '16px'
  },
  // Smooth animations
  className: 'premium-toast',
  bodyClassName: 'premium-toast-body',
  progressClassName: 'premium-toast-progress'
};

// User-friendly error messages mapping
const errorMessages = {
  // Network errors
  'Network Error': 'Unable to connect. Please check your internet connection.',
  'ERR_NETWORK': 'Connection lost. Please check your internet.',
  'ERR_CONNECTION_REFUSED': 'Server is not responding. Please try again later.',
  
  // Auth errors
  'Invalid credentials': 'Email or password is incorrect. Please try again.',
  'User not found': 'No account found with this email.',
  'Email already exists': 'This email is already registered. Try logging in instead.',
  'Invalid token': 'Your session has expired. Please log in again.',
  'Unauthorized': 'Please log in to continue.',
  
  // Validation errors
  'Required field': 'Please fill in all required fields.',
  'Invalid email': 'Please enter a valid email address.',
  'Password too short': 'Password must be at least 8 characters long.',
  'Passwords do not match': 'The passwords you entered don\'t match.',
  
  // Generic errors
  '404': 'The requested resource was not found.',
  '500': 'Something went wrong on our end. Please try again.',
  '503': 'Service temporarily unavailable. Please try again shortly.',
  
  // Default
  'default': 'Something went wrong. Please try again.'
};

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error) {
  if (typeof error === 'string') {
    // Check if it's a known error
    for (const [key, message] of Object.entries(errorMessages)) {
      if (error.includes(key)) {
        return message;
      }
    }
    // Return the original if it's already user-friendly
    if (error.length < 100 && !error.includes('Error:') && !error.includes('Exception')) {
      return error;
    }
  }
  
  // Handle error objects
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    // Use backend message if it's user-friendly
    if (data?.message && data.message.length < 100) {
      return data.message;
    }
    
    if (data?.error && data.error.length < 100) {
      return data.error;
    }
    
    // Status-based messages
    if (status === 401) return errorMessages['Unauthorized'];
    if (status === 404) return errorMessages['404'];
    if (status === 500) return errorMessages['500'];
    if (status === 503) return errorMessages['503'];
  }
  
  // Handle network errors
  if (error?.message) {
    for (const [key, message] of Object.entries(errorMessages)) {
      if (error.message.includes(key)) {
        return message;
      }
    }
  }
  
  return errorMessages['default'];
}

/**
 * Premium Toast Utilities
 */
const toast = {
  /**
   * Success toast - Green theme
   */
  success: (message, options = {}) => {
    reactToast.success(message, {
      ...defaultConfig,
      ...options,
      style: {
        ...defaultConfig.style,
        background: 'linear-gradient(135deg, #0d2923 0%, #1a4037 100%)',
        border: '1px solid #2d6a4f',
        ...options.style
      },
      icon: "✓",
      autoClose: options.autoClose !== undefined ? options.autoClose : 2000 // 2 seconds
    });
  },

  /**
   * Error toast - Red theme with user-friendly messages
   */
  error: (error, options = {}) => {
    const message = getUserFriendlyMessage(error);
    
    reactToast.error(message, {
      ...defaultConfig,
      ...options,
      style: {
        ...defaultConfig.style,
        background: 'linear-gradient(135deg, #2d0a0a 0%, #4a0e0e 100%)',
        border: '1px solid #8b0000',
        ...options.style
      },
      icon: "✕",
      autoClose: options.autoClose !== undefined ? options.autoClose : 2000 // 2 seconds
    });
  },

  /**
   * Warning toast - Yellow theme
   */
  warning: (message, options = {}) => {
    reactToast.warning(message, {
      ...defaultConfig,
      ...options,
      style: {
        ...defaultConfig.style,
        background: 'linear-gradient(135deg, #2d2410 0%, #4a3a1a 100%)',
        border: '1px solid #d4a017',
        ...options.style
      },
      icon: "⚠",
      autoClose: options.autoClose !== undefined ? options.autoClose : 2000 // 2 seconds
    });
  },

  /**
   * Info toast - Blue theme
   */
  info: (message, options = {}) => {
    reactToast.info(message, {
      ...defaultConfig,
      ...options,
      style: {
        ...defaultConfig.style,
        background: 'linear-gradient(135deg, #0a1a2d 0%, #1a2a4a 100%)',
        border: '1px solid #4a90e2',
        ...options.style
      },
      icon: "ℹ",
      autoClose: options.autoClose !== undefined ? options.autoClose : 2000 // 2 seconds
    });
  },

  /**
   * Loading toast - Shows until dismissed
   */
  loading: (message, options = {}) => {
    return reactToast.loading(message, {
      ...defaultConfig,
      ...options,
      autoClose: false,
      closeButton: false,
      style: {
        ...defaultConfig.style,
        background: 'linear-gradient(135deg, #1a1a2d 0%, #2a2a4a 100%)',
        border: '1px solid #4a4a6a',
        ...options.style
      }
    });
  },

  /**
   * Update existing toast (useful for loading states)
   */
  update: (toastId, options) => {
    reactToast.update(toastId, {
      ...defaultConfig,
      ...options,
      isLoading: false,
      autoClose: options.autoClose !== undefined ? options.autoClose : 2000 // 2 seconds
    });
  },

  /**
   * Dismiss toast
   */
  dismiss: (toastId) => {
    if (toastId) {
      reactToast.dismiss(toastId);
    } else {
      reactToast.dismiss();
    }
  },

  /**
   * Promise-based toast (auto handles loading, success, error)
   */
  promise: (promise, messages, options = {}) => {
    return reactToast.promise(
      promise,
      {
        pending: {
          render: messages.pending || 'Processing...',
          ...defaultConfig,
          ...options.pending
        },
        success: {
          render: messages.success || 'Success!',
          ...defaultConfig,
          autoClose: 2000, // 2 seconds
          ...options.success
        },
        error: {
          render: ({ data }) => getUserFriendlyMessage(data),
          ...defaultConfig,
          autoClose: 2000, // 2 seconds
          ...options.error
        }
      },
      defaultConfig
    );
  }
};

// Add custom CSS for smooth animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .premium-toast {
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .Toastify__toast--default {
      transition: all 0.3s ease-in-out;
    }
    
    .Toastify__toast {
      backdrop-filter: blur(10px);
    }
    
    .premium-toast-progress {
      background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.7));
    }
  `;
  document.head.appendChild(style);
}

export default toast;
