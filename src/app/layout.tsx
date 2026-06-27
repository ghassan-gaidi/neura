import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";
import MatrixRain from "@/components/MatrixRain";
import Nav from "@/components/Nav";
import { SoftwareApplicationSchema } from "@/components/seo/SoftwareApplicationSchema";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";
import { APIReferenceSchema } from "@/components/seo/APIReferenceSchema";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["800"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://neura.sh"),
  title: {
    default: "Neura — External Brain for AI Agents",
    template: "%s | Neura",
  },
  description:
    "Persistent memory and state for AI agents. Store facts with auto-embedding, search by natural language, pay with USDC on Base. Zero SDK required. Open source.",
  keywords: [
    "AI agent memory",
    "vector database",
    "semantic search API",
    "persistent memory for AI",
    "AI external brain",
    "agentic memory",
    "pgvector",
    "OpenAI embeddings",
    "Base blockchain payments",
    "USDC micropayments",
    "autonomous AI payments",
    "x402 crypto payments",
    "AI agent SDK",
    "AI memory API",
    "semantic search for agents",
    "neura AI",
    "external brain for AI",
    "AI context memory",
  ],
  authors: [{ name: "ghassan-gaidi", url: "https://github.com/ghassan-gaidi" }],
  creator: "ghassan-gaidi",
  publisher: "Neura",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
    
  },
  alternates: {
    canonical: "https://neura.sh",
    languages: {
      "en-US": "https://neura.sh",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://neura.sh",
    siteName: "Neura",
    title: "Neura — External Brain for AI Agents",
    description:
      "Persistent memory and state for AI agents. Store facts with auto-embedding, search by natural language, pay with USDC on Base. Zero SDK required.",
    images: [
      {
        url: "/og/home.svg",
        width: 1200,
        height: 630,
        alt: "Neura — External Brain for AI Agents",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@LeoFalco2574",
    creator: "@LeoFalco2574",
    title: "Neura — External Brain for AI Agents",
    description:
      "Persistent memory for AI agents. Store, search, persist state. Pay with USDC on Base. Open source.",
    images: ["/og/home.svg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/og/home.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="search" type="application/opensearchdescription+xml" title="Neura" href="/opensearch.xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col text-white">
        <SoftwareApplicationSchema />
        <OrganizationSchema />
        <APIReferenceSchema />
        <MatrixRain />
        <Nav />
        <main className="flex-1 relative z-10">{children}</main>
      </body>
    </html>
  );
}