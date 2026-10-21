import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // GLB models and stills are served from R2 once they exist. Add the R2 public domain here then.
  images: { remotePatterns: [] },
};

export default config;
