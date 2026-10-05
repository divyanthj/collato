const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
    outputFileTracingIncludes: {
      "/api/workspace-reports/*/export": ["./node_modules/pdfkit/js/standard-fonts/**/*"]
    }
  },
  async redirects() {
    return [
      {
        source: "/workspace",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/workspace/:path*",
        destination: "/dashboard/:path*",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
