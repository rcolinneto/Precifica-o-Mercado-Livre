import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precificador Dipil",
  description: "Precificação de produtos para Mercado Livre",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
