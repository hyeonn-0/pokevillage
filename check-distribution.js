// Invariant check for distribution.json. Run after gen-distribution.js.
//
// The one that matters: any file a player edits in-game must ship WITHOUT an MD5.
// Helios re-downloads MD5-declared files whenever the local hash drifts, so an MD5 on
// a user-preference file silently reverts their settings on every launch (this is how
// voicechat keybinds were being wiped).

const fs = require('fs')
const path = require('path')

const dist = JSON.parse(fs.readFileSync(path.join(__dirname, 'distribution.json'), 'utf8'))
const files = dist.servers[0].modules.filter((m) => m.type === 'File')
const byPath = new Map(files.map((m) => [m.artifact.path, m]))

// Files the player owns. Seeded once, never re-validated.
const MUST_BE_SEED_ONCE = [
  'options.txt',
  'servers.dat',
  'config/voicechat/voicechat-client.properties',
  'config/voicechat/player-volumes.properties',
  'config/voicechat/category-volumes.properties',
  'config/voicechat/username-cache.json',
  'config/xaero/minimap/client.cfg',
  'config/xaero/world-map/client.cfg',
  'config/xaero/lib/client.cfg',
  'config/sodium-options.json',
  'config/iris.properties',
  'config/MouseTweaks.cfg',
  'config/modmenu.json',
  'config/yacl.json5',
  'config/chat_heads.json5',
  'config/fancymenu/options.txt',
  'config/rctmod-client.toml',
  'config/ftbchunks-client.snbt',
]

// Files that define the pack. These must keep their MD5 so updates actually reach players.
const MUST_BE_SYNCED = [
  'config/cobblemonraiddens/tier_one.json5',
  'config/cobblemonraiddens/common.json5',
  'config/simpletms/main.json',
  'config/cobbledollars/default_shop.json',
  'config/cobblemon/main.json',
  'config/mythsandlegends/config.toml',
  'config/terralith.json',
  'config/fancymenu/customization/menu_layout.txt',
  'config/rctmod-server.toml',
  // Which packs are force-enabled lives here, NOT in options.txt. options.txt has to stay
  // seed-once to protect keybinds, so this file is the only channel that can turn a pack on
  // for players who already have an install.
  'config/resourcepackoverrides.json',
]

// JEI was replaced by REI in v1.0.3 — its configs must not ship any more.
const MUST_BE_ABSENT = [/^config\/jei\//]

const fail = []

for (const p of MUST_BE_SEED_ONCE) {
  const m = byPath.get(p)
  if (!m) { fail.push(`missing entirely: ${p}`); continue }
  if (m.artifact.MD5) fail.push(`has MD5 but is user-owned (will be overwritten): ${p}`)
}

for (const p of MUST_BE_SYNCED) {
  const m = byPath.get(p)
  if (!m) { fail.push(`missing entirely: ${p}`); continue }
  if (!m.artifact.MD5) fail.push(`no MD5 but is pack-defining (updates won't reach players): ${p}`)
}

for (const re of MUST_BE_ABSENT) {
  for (const m of files) {
    if (re.test(m.artifact.path)) fail.push(`should no longer ship: ${m.artifact.path}`)
  }
}

if (fail.length) {
  console.error(`FAIL (${fail.length})`)
  for (const f of fail) console.error('  - ' + f)
  process.exit(1)
}
console.log(`OK — ${files.length} File modules, invariants hold`)
