/**
 * Static copy for the PDP's "Envío y armado" tab (design D5b/Tabs task 6.7,
 * obs #615's copy rule).
 *
 * ONLY ONE claim below is vetted: "Envíos a todo el país", already published
 * by `AnnounceBar.tsx` and repeated verbatim by `Reassurance.tsx`. Every
 * other sentence this tab COULD plausibly carry — a delivery window, a
 * shipping cost, whether assembly ("armado") is included or costs extra, a
 * warranty, a returns policy, or a named contact channel (email/WhatsApp/
 * phone) — has no source anywhere in this repository and is deliberately NOT
 * written here.
 *
 * obs #615: a previous PR shipped "Coordinamos la entrega de tu pedido" and
 * "Consultas y postventa por WhatsApp" on the home page, wrapped in a
 * docblock that falsely guaranteed the copy was vetted; both claims were
 * unbacked and were deleted after review caught them. This file is the
 * single most likely place in this phase for the same mistake to repeat, so
 * it repeats none of it: no ETA, no price, no assembly promise, no warranty,
 * no returns policy, no channel name.
 *
 * The second line is the one fallback explicitly allowed for this case: an
 * honest invitation to ask, without naming a channel that does not exist in
 * the repo. Adding anything else — including any statement about assembly,
 * which the tab's own title mentions but which has zero source — requires
 * the owner to supply and approve the exact sentence first.
 */
export const SHIPPING_COPY = ["Envíos a todo el país.", "Consultanos por tu caso."] as const;
