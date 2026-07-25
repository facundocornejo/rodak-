import styles from "./CategoryHeader.module.css";

export interface CategoryHeaderProps {
  name: string;
  productCount: number;
}

/**
 * Category page header: eyebrow + `<h1>` + product count. Typographic only —
 * zero `<img>`/`next/image` above the grid (design D4: no `Category.imageUrl`
 * exists and none is derived from an arbitrary product's media, which would
 * misrepresent the category and depend on media ordering).
 *
 * The count is read straight off `CategoryDTO.productCount` (the DAL's
 * `_count.products`), never off the paginated grid's `items.length` — the
 * header must report the category's real total even when only one page of it
 * is on screen.
 */
export function CategoryHeader({ name, productCount }: CategoryHeaderProps) {
  return (
    <header className={styles.head}>
      <span className={styles.eyebrow}>Categoría</span>
      <h1 className={styles.title}>{name}</h1>
      <p className={styles.count}>
        {productCount} {productCount === 1 ? "producto" : "productos"}
      </p>
    </header>
  );
}
