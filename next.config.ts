import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.31.31'],
  serverExternalPackages: ['pdfjs-dist', 'sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  // Tools were flattened to /tools/<tool>. Keep the old nested URLs working
  // (permanent → 308) so existing links and search results don't 404.
  async redirects() {
    const moved: Array<[string, string]> = [
      ['/tools/pdf/merge-pdf', '/tools/merge-pdf'],
      ['/tools/pdf/split', '/tools/split-pdf'],
      ['/tools/pdf/compress-pdf', '/tools/compress-pdf'],
      ['/tools/pdf/add-pg-no', '/tools/add-page-numbers'],
      ['/tools/pdf/watermark-pdf', '/tools/watermark-pdf'],
      ['/tools/pdf/sign-pdf', '/tools/sign-pdf'],
      ['/tools/pdf/image-to-pdf', '/tools/image-to-pdf'],
      ['/tools/pdf/pdf-to-image', '/tools/pdf-to-image'],
      ['/tools/image/compress', '/tools/compress-image'],
      ['/tools/image/resize', '/tools/resize-image'],
      ['/tools/image/crop', '/tools/crop-image'],
      ['/tools/image/watermark', '/tools/watermark-image'],
      ['/tools/image/rotate', '/tools/rotate-image'],
      ['/tools/image/flip', '/tools/flip-image'],
      ['/tools/image/remove-metadata', '/tools/remove-image-metadata'],
      ['/tools/image/image-to-jpg', '/tools/image-to-jpg'],
      ['/tools/image/jpg-to-png', '/tools/jpg-to-png'],
      ['/tools/image/image-to-webp', '/tools/image-to-webp'],
      ['/tools/image/html-to-image', '/tools/html-to-image'],
    ]

    return moved.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }))
  },
};

export default nextConfig;
