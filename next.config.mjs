/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fotos de intimação enviadas pelo formulário (documentos grandes vão direto ao armazenamento)
  experimental: { serverActions: { bodySizeLimit: "4mb" }, serverComponentsExternalPackages: ["unpdf"] },
};

export default nextConfig;
