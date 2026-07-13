import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The OpenSCAD wasm runtime and font bundle are served from public/openscad
  // and fetched inside a web worker; nothing special needed for them here.
}

export default nextConfig
