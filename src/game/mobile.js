/** Device-tuned quality choices that stay deterministic and independently testable. */
export const QUALITY_OPTIONS = Object.freeze(['auto', 'eco', 'balanced', 'high'])

export function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
}

export function recommendQuality({ coarse = false, memory = undefined, cores = undefined } = {}) {
  // Memory/CPU hints are not available in every Android browser; be conservative.
  if (!coarse) return 'high'
  if ((typeof memory === 'number' && memory <= 4) || (typeof cores === 'number' && cores <= 4)) return 'eco'
  return 'balanced'
}

export function getRenderBudget(quality = 'auto', { coarse = false, memory, cores } = {}) {
  const chosen = quality === 'auto' ? recommendQuality({ coarse, memory, cores }) : quality
  const level = QUALITY_OPTIONS.includes(chosen) && chosen !== 'auto' ? chosen : 'balanced'
  const budgets = {
    eco: { dpr: 0.8, shadows: false, shadowMap: 256, antialias: false, objectsCastShadows: false, label: 'Eco · battery saver' },
    balanced: { dpr: coarse ? 1.05 : 1.3, shadows: false, shadowMap: 512, antialias: false, objectsCastShadows: false, label: 'Balanced · smooth driving' },
    high: { dpr: coarse ? 1.35 : 1.65, shadows: true, shadowMap: 768, antialias: !coarse, objectsCastShadows: true, label: 'High · sharper graphics' },
  }
  return { ...budgets[level], tier: level }
}

export function safeStoredQuality(value) {
  return QUALITY_OPTIONS.includes(value) ? value : 'auto'
}

/** Each pointer independently holds one control. Losing a pointer always releases it. */
export function createHeldInput(inputRef, action) {
  const pointers = new Set()
  return {
    down(id) { pointers.add(id); inputRef.current[action] = true },
    up(id) { pointers.delete(id); inputRef.current[action] = pointers.size > 0 },
    reset() { pointers.clear(); inputRef.current[action] = false },
    get size() { return pointers.size },
  }
}
