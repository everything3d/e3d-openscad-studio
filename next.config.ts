import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The OpenSCAD wasm runtime (9.6 MB) and font bundle (7.1 MB) are
        // fetched by the render worker. Next serves public/ files with
        // max-age=0, so every session revalidated both; the worker now
        // requests them with a version query (OPENSCAD_ASSET_VERSION in
        // render.worker.ts), which makes a long immutable lifetime safe.
        source: '/openscad/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
