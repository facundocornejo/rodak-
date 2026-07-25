import styles from "./DescriptionTab.module.css";

export interface DescriptionTabProps {
  /** `ProductDetailDTO.description` — passed through verbatim by the DAL. */
  description: string | null;
}

/**
 * The only copy this component ever shows for an empty description. Never
 * invented prose, never a blank panel: 22 of 88 real products carry an empty
 * description (`""` or `null` — the DAL does not normalize one into the
 * other, so both are handled here), which makes this the common case for
 * roughly a quarter of the catalog, not a rare edge case.
 */
const EMPTY_FALLBACK = "Todavía no cargamos la descripción de este producto.";

export function DescriptionTab({ description }: DescriptionTabProps) {
  const text = description !== null && description.trim() !== "" ? description : EMPTY_FALLBACK;

  return <p className={styles.text}>{text}</p>;
}
