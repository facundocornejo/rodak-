import styles from "./Reassurance.module.css";

/**
 * Static reassurance list under the PDP buy column (design component
 * inventory: "Reassurance S, static", no CTA — design D8b). Server
 * Component, zero state, zero interaction.
 *
 * Copy discipline (obs #615, binding on every PR that writes visible copy —
 * see `TrustRow.tsx`'s own note, which this deliberately mirrors): these are
 * the EXACT three claims `AnnounceBar` already publishes, same wording, no
 * elaboration. No shipping ETA, no guarantee, no return policy and no
 * contact channel are added here — there is nothing in this repository that
 * backs any of those, and a storefront promise the business has not agreed
 * to is a defect, not copy. Adding a fourth item, or a supporting line under
 * any of these, requires the owner's approval of that exact sentence.
 *
 * Icons are inline SVG, never `→`/`★`/`✓` text glyphs (the self-hosted font
 * subset is latin-only and silently falls back for those) — same paths as
 * `TrustRow.tsx`, kept local rather than imported so this component has no
 * dependency on the home surface.
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

export function Reassurance() {
  return (
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
          <span className={styles.text}>{item.title}</span>
        </li>
      ))}
    </ul>
  );
}
