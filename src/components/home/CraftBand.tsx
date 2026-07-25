import styles from "./CraftBand.module.css";

/**
 * Dark island (design D14, the second and last of the two dark islands),
 * static — no photograph: the same reasoning as `Hero` applies (no craft/
 * workshop photography exists in this repo, and none is invented). No link
 * either: an "about" page does not exist yet in this phase, and a link to
 * nowhere would be a dead `#` link [INV-10].
 */
export function CraftBand() {
  return (
    <section className={styles.band} data-island="dark">
      <div className={styles.inner}>
        <span className={styles.eyebrow}>Nuestra obsesión</span>
        <h2 className={styles.title}>Muebles que duran toda una vida.</h2>
        <p className={styles.body}>
          Cada pieza Rodak se hace con madera maciza y estructura de hierro con
          pintura electroestática. Nada de aglomerado, nada de melamina: piezas
          robustas, pensadas para tu espacio de trabajo diario.
        </p>
      </div>
    </section>
  );
}
