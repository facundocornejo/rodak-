"use client";

import { useState } from "react";

import Image from "next/image";

import styles from "./Gallery.module.css";

export interface GalleryMediaItem {
  url: string;
  alt: string;
}

export interface GalleryProps {
  /** DAL order (`position asc, url asc`, `src/lib/data/products.ts`). */
  media: GalleryMediaItem[];
}

/** Design D13-PDP's image-slot contract for this surface. */
const STAGE_SIZES = "(min-width:1024px) 620px, 100vw";

/**
 * PDP stage + thumbnails (client: owns which image is active, no server
 * data of its own — `media` is a flat DTO array [INV-9]).
 *
 * The stage reserves `aspect-ratio: 1` before any image paints, so switching
 * thumbnails — or the image simply loading — never shifts layout (design
 * "states: no CLS").
 *
 * Only the PHYSICALLY FIRST item (`media[0]`) ever carries `preload`, tied to
 * `activeIndex === 0` rather than to whichever image is on screen: the page
 * opens on `media[0]`, so that is the one real LCP candidate, and clicking a
 * thumbnail after hydration is a client interaction that must not add a
 * second preload link (design "exactly one preload per page").
 *
 * Zoom is a simple CSS hover scale on the stage image — no modal, no
 * complex overlay (Baymard guidance cited in the task); it degrades to "no
 * zoom" on touch, which is an accepted simplicity trade-off for this catalog.
 */
export function Gallery({ media }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = media[activeIndex] ?? null;

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        {active === null ? (
          <div className={styles.placeholder} aria-hidden="true" />
        ) : (
          <Image
            key={active.url}
            src={active.url}
            alt={active.alt}
            fill
            sizes={STAGE_SIZES}
            preload={activeIndex === 0}
            className={styles.image}
          />
        )}
      </div>
      {media.length > 1 && (
        <ul className={styles.thumbs}>
          {media.map((item, index) => (
            <li key={item.url}>
              <button
                type="button"
                className={index === activeIndex ? `${styles.thumb} ${styles.thumbActive}` : styles.thumb}
                aria-current={index === activeIndex}
                aria-label={`Ver imagen ${index + 1} de ${media.length}`}
                onClick={() => setActiveIndex(index)}
              >
                <Image
                  src={item.url}
                  alt=""
                  width={76}
                  height={76}
                  className={styles.thumbImage}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
