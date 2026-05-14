import { FAQSchema } from "@/components/seo/FAQSchema";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation",
  description:
    "Neura API reference — memory, state, webhooks, payments. HTTP API for AI agent memory. Semantic search, embeddings, autonomous USDC payments on Base.",
  keywords: [
    "Neura API",
    "AI memory API",
    "semantic search API",
    "HTTP API for AI",
    "pgvector API",
    "OpenAI embeddings API",
    "agent memory API",
    "API documentation",
    "x402 payments",
  ],
  alternates: {
    canonical: "https://neura.sh/docs",
  },
  openGraph: {
    title: "Neura API Documentation",
    description:
      "Full API reference for the Neura external brain API. Memory, state, webhooks, payments.",
    images: [{ url: "/og/home.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neura API Documentation",
    description: "Full API reference for AI agent memory.",
    images: ["/og/home.svg"],
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export { FAQSchema };