/**
 * Application configuration constants
 */

export const APP_CONFIG = {
  name: 'Streb',
  description: 'All-in-one marketing automation platform for SaaS/app builders',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  signIn: '/auth/sign-in',
  signUp: '/auth/sign-up',
  api: {
    health: '/api/health',
  },
} as const;
