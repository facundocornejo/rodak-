import { AnnounceBar } from "@/components/chrome/AnnounceBar";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/chrome/SiteHeader";

/**
 * Storefront chrome. Every component below is static and performs zero
 * database reads, so this layout can never be the reason a page fails when
 * Postgres is unreachable.
 *
 * `<main>` is intentionally NOT rendered here: each page owns its own `<main>`
 * landmark (nesting them would be invalid), and `globals.css` gives that
 * element the flex growth that keeps the footer at the bottom.
 */
export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AnnounceBar />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
