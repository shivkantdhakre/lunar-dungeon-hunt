import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dungeon-hunt/shared-contracts', '@dungeon-hunt/game-rules'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
