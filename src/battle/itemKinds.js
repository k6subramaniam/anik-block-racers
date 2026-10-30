/** Power-up kinds shared by the Voxel Valley race (items.js) and the battle circuits
 * (circuitItems.js): the same four items, labels and deterministic dice.
 */
export const ITEM_KINDS=Object.freeze(['turbo','shield','rocket','oil'])
export const ITEM_LABELS=Object.freeze({turbo:'TURBO',shield:'SHIELD',rocket:'ROCKET',oil:'OIL SLICK'})

// Deterministic per pickup, so races replay identically and tests are stable.
export function rollItem(seed){
 let x=Math.imul(seed|0,2654435761)>>>0
 x=Math.imul(x^(x>>>15),2246822519)>>>0
 x=(x^(x>>>13))>>>0
 return ITEM_KINDS[x%ITEM_KINDS.length]
}
