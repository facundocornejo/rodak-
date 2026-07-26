"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import styles from "./Tabs.module.css";

export interface TabDefinition {
  id: string;
  label: string;
  /**
   * Pre-rendered content (may itself contain a `<Suspense>` boundary — see
   * `producto/[slug]/page.tsx`). This component never fetches anything and
   * never unmounts a panel on tab switch: all four are mounted at all times,
   * only visibility toggles, so a Suspense boundary inside one of them
   * resolves exactly once per page load, not once per tab click.
   */
  content: ReactNode;
}

export interface TabsProps {
  tabs: readonly TabDefinition[];
}

/**
 * Four fixed PDP tabs (Descripción/Specs/Envío/Reseñas — task 6.7), always
 * rendered regardless of product data (a tab set that changes shape per
 * product would hide the SKU on some products and not others).
 *
 * PR8 review-follow-up fix: this docblock used to say "Envío y armado",
 * stale since PR7 renamed the rendered tab label to "Envío"
 * (`producto/[slug]/page.tsx`).
 *
 * Real `role="tablist"` implementation, not a half-implemented one (design
 * rule: "half-correct ARIA is worse than none"): `role="tab"`/`aria-selected`/
 * `aria-controls` on each control, `role="tabpanel"`/`aria-labelledby` on
 * each panel, roving tabindex (only the selected tab is a Tab stop), and
 * Left/Right/Home/End move focus AND selection together — the standard
 * "manual activation? no — automatic activation" tablist pattern, chosen
 * because switching panels here is cheap (no network refetch, panels are
 * already mounted) so there is no reason to require a second Enter/Space
 * press.
 *
 * Selected state is never colour-only: a visible underline + bold weight
 * (`Tabs.module.css`) alongside `aria-selected`. `:focus-visible` gives the
 * required visible focus ring for free (global rule, `globals.css`).
 */
export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? "");
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function activate(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (tab === undefined) return;
    setActiveId(tab.id);
    tabRefs.current[tab.id]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        activate(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        activate(index - 1);
        break;
      case "Home":
        event.preventDefault();
        activate(0);
        break;
      case "End":
        event.preventDefault();
        activate(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tablist} role="tablist" aria-label="Información del producto">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          const tabId = `${baseId}-tab-${tab.id}`;
          const panelId = `${baseId}-panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        const tabId = `${baseId}-tab-${tab.id}`;
        const panelId = `${baseId}-panel-${tab.id}`;

        return (
          <div
            key={tab.id}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!selected}
            className={styles.panel}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
