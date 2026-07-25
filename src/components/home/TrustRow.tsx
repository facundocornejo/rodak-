import styles from "./TrustRow.module.css";

/**
 * Static reassurance row (design D13/component inventory: "TrustRow S,
 * static").
 *
 * These three items are EXACTLY the three claims the owner already publishes
 * in `AnnounceBar` — same wording, no elaboration. That constraint is the
 * whole point of this component and it is not stylistic: an earlier draft
 * shipped "Coordinamos la entrega de tu pedido" and "Consultas y postventa
 * por WhatsApp", and the review caught that neither is backed by anything in
 * this repository — there is no WhatsApp channel, no number, no delivery
 * commitment anywhere. A storefront promise the business has not agreed to is
 * a defect, not copy.
 *
 * **Adding a fourth item, or a supporting line under any of these, requires
 * the owner's approval of that exact sentence.** Do not derive one from the
 * catalog, and do not soften an unapproved promise into a vaguer one.
 *
 * Icons are inline SVG, never `→`/`★`/`✓` text glyphs: the self-hosted font
 * subset is latin-only and silently falls back to a system font for those.
 */
const ITEMS = [
  {
    title: "Madera maciza y hierro",
    path: "M3 12a9 9 0 1 0 9-9 M3 4v5h5",
  },
  {
    title: "Hecho en Argentina",
    path: "M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z M9 12l2 2 4-4",
  },
  {
    title: "Envíos a todo el país",
    path: "M1 6h15v12H1z M16 9h4l3 3v4h-7z M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  },
] as const;

export function TrustRow() {
  return (
    <section className={styles.section}>
      <ul className={styles.list}>
        {ITEMS.map((item) => (
          <li key={item.title} className={styles.item}>
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d={item.path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className={styles.itemTitle}>{item.title}</h3>
          </li>
        ))}
      </ul>
    </section>
  );
}
