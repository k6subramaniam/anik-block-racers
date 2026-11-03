/** Which screen a URL opens, and the URL for each screen. Old links keep working:
 * `?challenge=` opens Bot Smash, `?view=world|battle` and the install shortcuts open
 * their modes, and everything else lands on the home screen. */
export const VIEWS = Object.freeze(['home', 'showdown', 'world', 'battle'])

export function viewFromSearch(search = '') {
  const p = new URLSearchParams(search)
  const view = p.get('view'), source = p.get('source')
  if (p.has('challenge') || view === 'showdown' || source === 'shortcut-showdown') return 'showdown'
  if (view === 'battle' || source === 'shortcut-battle') return 'battle'
  if (view === 'world' || source === 'shortcut' || source === 'shortcut-explore') return 'world'
  return 'home'
}

/** `options.explore` opens the open world directly; `options.invite` opens the friend
 * invite; a Bot Smash URL carries the challenge so shared links survive navigation. */
export function urlForView(href, view, options = {}) {
  const url = new URL(href)
  url.search = ''
  if (view !== 'battle') url.hash = ''
  if (view === 'world') {
    url.searchParams.set('view', 'world')
    if (options.explore) url.searchParams.set('source', 'shortcut-explore')
  } else if (view === 'battle') {
    url.searchParams.set('view', 'battle')
    if (options.invite) url.searchParams.set('invite', '1')
  } else if (view === 'showdown') {
    url.searchParams.set('view', 'showdown')
    if (options.challenge) url.searchParams.set('challenge', options.challenge)
    if (options.score != null) url.searchParams.set('score', options.score)
  }
  return url.toString()
}
