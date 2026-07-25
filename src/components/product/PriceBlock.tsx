import { formatPriceCents } from "@/lib/format";

import styles from "./PriceBlock.module.css";

/**
 * Renders a product's price, or "Consultar precio" when there is none to
 * show [INV-1, INV-4, design D8b]. Shared unchanged by the card (design
 * D5b/D13) and by the PDP (design D8b): callers pass numbers, not variants,
 * and do NOT need to pre-check anything.
 *
 * The `<=0` test below is deliberately the same rule as `isConsultPrice()` in
 * `src/lib/variants.ts`, applied to a number instead of to a variant object.
 * It is duplicated rather than imported because `isConsultPrice` takes a whole
 * `ProductVariantDTO`, which neither call site has at this point. If that rule
 * ever changes, BOTH places change — they are two applications of one
 * decision, not two decisions. The PDP will still call `isConsultPrice()`
 * itself for the availability copy (design D8b), which is a second call site,
 * not a second definition.
 *
 * `priceCents` is nullable because the CARD's inputs are `ProductCardDTO`'s
 * `fromPriceCents`/`fromSalePriceCents`, which the DAL already sets to `null`
 * when every variant is `priceCents<=0` (see `cheapestPricedVariant` in
 * `src/lib/data/products.ts`) — a real `ProductVariantDTO.priceCents` is
 * never `null`, only possibly `<=0`. This component treats BOTH as consult,
 * so it is safe regardless of which shape the caller has:
 *   - card: `<PriceBlock priceCents={product.fromPriceCents}
 *            salePriceCents={product.fromSalePriceCents} />`
 *   - PDP (PR6): `<PriceBlock priceCents={variant.priceCents}
 *            salePriceCents={variant.salePriceCents} />`
 */
export interface PriceBlockProps {
  priceCents: number | null;
  salePriceCents?: number | null;
}

export function PriceBlock({ priceCents, salePriceCents = null }: PriceBlockProps) {
  if (priceCents === null || priceCents <= 0) {
    return <p className={styles.consult}>Consultar precio</p>;
  }

  const hasSale =
    salePriceCents !== null &&
    salePriceCents !== undefined &&
    salePriceCents > 0 &&
    salePriceCents < priceCents;

  if (hasSale) {
    return (
      <p className={styles.price}>
        <span className={styles.now}>{formatPriceCents(salePriceCents)}</span>
        <span className={styles.was}>{formatPriceCents(priceCents)}</span>
      </p>
    );
  }

  return <p className={styles.price}>{formatPriceCents(priceCents)}</p>;
}
