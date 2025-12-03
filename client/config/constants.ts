export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

// Server configuration for local development
// Change this to your desktop's IP when testing on physical device
// WiFi: 10.0.0.6 | Radmin VPN: 26.156.183.10 | Mobile Hotspot: 192.168.137.1
const LOCAL_SERVER_IP = process.env.EXPO_PUBLIC_SERVER_IP || '10.0.0.6';

export const API_CONFIG = {
  // Main .NET Backend API
  BACKEND_URL: `http://${LOCAL_SERVER_IP}:5001`,
  
  // ML Service
  ML_SERVICE_URL: `http://${LOCAL_SERVER_IP}:5000`,
  
  // CB Service  
  CB_SERVICE_URL: `http://${LOCAL_SERVER_IP}:5002`,
  
  // ML Admin API
  ML_ADMIN_URL: `http://${LOCAL_SERVER_IP}:6000`,
  
  // ML Admin Dashboard
  ML_DASHBOARD_URL: `http://${LOCAL_SERVER_IP}:3000`,
}; 