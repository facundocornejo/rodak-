import styles from "./Availability.module.css";

export interface AvailabilityProps {
  /** The ONLY input this component reads. `stock` never reaches here [INV-2]. */
  inStock: boolean;
}

/**
 * PDP availability line. Text derives from `inStock` ONLY [INV-2] — no other
 * prop can change the rendered word, which is exactly what
 * `Availability.test.tsx` pins.
 *
 * The consult-price override ("A medida — se cotiza por pedido", design D8b)
 * is NOT handled here: that copy replaces this component entirely at the
 * call site (`ProductOptions.tsx`) when `isConsultPrice(selectedVariant)` is
 * true, so this component's own contract stays a pure function of `inStock`.
 */
export function Availability({ inStock }: AvailabilityProps) {
  return (
    <p className={inStock ? styles.inStock : styles.outOfStock}>
      {inStock ? "En stock" : "Sin stock"}
    </p>
  );
}
