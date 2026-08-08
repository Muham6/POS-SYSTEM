const nextConfig = {
  turbopack: { root: __dirname },
  allowedDevOrigins: ['172.20.10.3', '192.168.0.109'],
  images: {
    remotePatterns: [{ hostname: 'fcjauutzsycussazshho.supabase.co' }],
  },
}

export default nextConfig