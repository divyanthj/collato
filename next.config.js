const nextConfig = {
  reactStrictMode: true,
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
