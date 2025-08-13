/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const withPWANextConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [],
});

const nextConfig = {};

export default withPWANextConfig(nextConfig);
