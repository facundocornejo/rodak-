import Image from "next/image";
import Link from "next/link";

import type { ProductCardDTO } from "@/lib/data/products";
import { product as productHref } from "@/lib/routes";

import { PriceBlock } from "./PriceBlock";
import { ProductTagBadge } from "./ProductTagBadge";
import { SwatchRow } from "./SwatchRow";
import styles from "./ProductCard.module.css";

/** Design's image-slot contract for this surface (D13 component inventory). */
const DEFAULT_SIZES = "(min-width:1100px) 280px, (min-width:700px) 45vw, 90vw";

export interface ProductCardProps {
  product: ProductCardDTO;
  /**
   * Marks this card's image as the page's ONE `preload` image (design D13:
   * "exactly one `preload` per page, everything else lazy"). The grid
   * component that renders a list of cards (PR4b's `ProductGrid`) owns that
   * decision and must pass `true` for index 0 only — `ProductCard` itself has
   * no way to know its position in a list, so it defaults to lazy.
   */
  preload?: boolean;
  sizes?: string;
}

/**
 * One catalog card: image, name, category, price, availability (derived only
 * from `inStock` [INV-2] — `stock` never reaches this component because the
 * DTO never carries it), materials, highlight tag. No quantity control, no
 * add-to-cart, no bundle affordance and no dead `#` link anywhere [INV-10] —
 * the whole card is a single link to the PDP, built with `routes.product()`
 * [INV-5].
 */
export function ProductCard({ product, preload = false, sizes = DEFAULT_SIZES }: ProductCardProps) {
  return (
    <li className={styles.card}>
      <Link href={productHref(product.slug)} className={styles.link}>
        <div className={styles.stage}>
          {product.image === null ? (
            <div className={styles.placeholder} aria-hidden="true" />
          ) : (
            <Image
              src={product.image.url}
              alt={product.image.alt}
              fill
              sizes={sizes}
              preload={preload}
              className={styles.image}
            />
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.eyebrow}>
            <ProductTagBadge tag={product.tag} />
            {product.categoryName !== null && (
              <span className={styles.category}>{product.categoryName}</span>
            )}
          </div>
          <h3 className={styles.name}>{product.name}</h3>
          <PriceBlock priceCents={product.fromPriceCents} salePriceCents={product.fromSalePriceCents} />
          {/* Availability derives ONLY from `inStock` [INV-2]. The in-stock
              case renders nothing extra — a card whose product is simply
              available needs no badge (hierarchy: recede the normal case). */}
          {!product.inStock && <p className={styles.outOfStock}>Sin stock</p>}
          <SwatchRow materials={product.materials} />
        </div>
      </Link>
    </li>
  );
}
