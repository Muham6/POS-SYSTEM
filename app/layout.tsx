import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// The browser tab, bookmarks and shared links should carry the shop's own
// name, not the name of the software. Falls back only if settings can't be
// read — e.g. before the database is reachable.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("id", 1)
      .single();

    const name = data?.store_name?.trim();
    if (name) {
      return { title: name, description: `${name} — point of sale` };
    }
  } catch {
    // Fall through to the generic title.
  }

  return { title: "POS System", description: "Point of sale system" };
}

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
