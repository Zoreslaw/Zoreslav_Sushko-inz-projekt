export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

export const API_CONFIG = {
  // For development, use your local IP address or localhost
  // For production, use your production backend URL
  BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.0.0.6:5001',
  // Alternative for Android emulator: 'http://10.0.2.2:5001'
  // Alternative for local network: 'http://192.168.1.xxx:5001' (replace with your IP)
}; 