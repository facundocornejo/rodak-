import type { Metadata } from "next";

const siteUrl = process.env.STAGING_HOST
  ? `https://${process.env.STAGING_HOST}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rodak",
    template: "%s | Rodak",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
