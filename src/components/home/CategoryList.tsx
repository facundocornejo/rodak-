import Link from "next/link";

import type { CategoryDTO } from "@/lib/data/categories";
import { category as categoryHref } from "@/lib/routes";

import styles from "./CategoryList.module.css";

export interface CategoryListProps {
  categories: CategoryDTO[];
}

/**
 * Every link is built with `routes.ts`'s `category(slug)` [INV-5]. Renders
 * nothing when the catalog has zero categories yet — a heading over an empty
 * list would be a section that promises content it does not have; the grid
 * below already carries its own defined empty state.
 */
export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>Categorías</span>
          <h2 className={styles.title}>Explorá por tipo de mueble</h2>
        </div>
        <ul className={styles.list}>
          {categories.map((cat) => (
            <li key={cat.slug}>
              <Link href={categoryHref(cat.slug)} className={styles.pill}>
                <span className={styles.name}>{cat.name}</span>
                <span className={styles.count}>{cat.productCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
