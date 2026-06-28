import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dice Invoker",
  description: "Invoque monstros, defenda sua dungeon e expulse aventureiros privatizadores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
