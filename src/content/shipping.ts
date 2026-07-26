/**
 * Static copy for the PDP's "Envío" tab (design D5b/Tabs task 6.7, obs #615's
 * copy rule).
 *
 * PR7 review WARNING, fixed here: the tab used to be titled "Envío y armado"
 * but this file never contained a single word about assembly — a tab that
 * promises information it does not have is a small false promise. The
 * honest fix is the tab's own label (`producto/[slug]/page.tsx`, changed to
 * "Envío"), not an invented sentence here. **The assembly ("armado") section
 * returns — and the tab may be renamed back — once the owner supplies and
 * approves the exact sentence describing it.** Nothing in this file should
 * be extended to imply assembly information exists until then.
 *
 * ONLY ONE claim below is vetted: "Envíos a todo el país", already published
 * by `AnnounceBar.tsx` and repeated verbatim by `Reassurance.tsx`. Every
 * other sentence this tab COULD plausibly carry — a delivery window, a
 * shipping cost, whether assembly is included or costs extra, a warranty, a
 * returns policy, or a named contact channel (email/WhatsApp/phone) — has no
 * source anywhere in this repository and is deliberately NOT written here.
 *
 * obs #615: a previous PR shipped "Coordinamos la entrega de tu pedido" and
 * "Consultas y postventa por WhatsApp" on the home page, wrapped in a
 * docblock that falsely guaranteed the copy was vetted; both claims were
 * unbacked and were deleted after review caught them. This file is the
 * single most likely place in this phase for the same mistake to repeat.
 *
 * PR7 review WARNING, fixed here (the second one): the previous second line,
 * "Consultanos por tu caso.", invited the visitor to get in touch through a
 * channel that does not exist anywhere in this storefront — no phone, no
 * email, no form, no link. A call to action with no destination is worse
 * than none, so it was removed rather than softened; one honest sentence is
 * the correct size for this file until the owner supplies a real channel (or
 * the assembly copy, or both).
 */
export const SHIPPING_COPY = ["Envíos a todo el país."] as const;
