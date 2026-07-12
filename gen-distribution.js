// PokeVillage distribution.json generator (full profile: mods + config + resourcepacks + options + servers.dat)
// Inputs : mods_hashes.json (name/size/md5), profile_extra.json (category/path/size/md5)
// Output : distribution.json (Helios-compatible)
// Re-run after editing CONFIG (e.g. real GitHub id / release tag) to regenerate instantly.

const fs = require('fs')
const path = require('path')

// ---------------- CONFIG (edit these) ----------------
const CONFIG = {
  githubUser: 'hyeonn-0',
  repo: 'pokevillage',
  branch: 'main',
  releaseTag: 'modpack-v1',           // bump each modpack version
  serverAddress: 'create.kinetichosting.gg',
  serverName: 'PokeVillage',
  serverId: 'PokeVillage-1.21.1',
  serverVersion: '1.0.0',             // bump when distribution changes
  mcVersion: '1.21.1',
  fabricLoader: '0.19.3',             // verified latest loader for 1.21.1 (meta.fabricmc.net)
  fabricLoaderSize: 1976502,
  fabricLoaderMD5: '881e0e9f53a11b9ad468b47afd678bfd',
  versionManifestSize: 2862,
  versionManifestMD5: 'b53ec01e703f1447e2cf4b5f5d495200',
  // Resourcepacks listed here are treated as optional (required:false, off by default).
  optionalResourcepacks: ['Pokemusic-Enviroment v3.0 COBLEMON.zip'],
}
// -----------------------------------------------------

const SCRATCH = __dirname
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(SCRATCH, f), 'utf8').replace(/^﻿/, ''))

const mods = readJson('mods_hashes.json')
const extra = readJson('profile_extra.json')

const releaseBase = `https://github.com/${CONFIG.githubUser}/${CONFIG.repo}/releases/download/${CONFIG.releaseTag}`
const rawBase = `https://raw.githubusercontent.com/${CONFIG.githubUser}/${CONFIG.repo}/${CONFIG.branch}`
const enc = (p) => p.split('/').map(encodeURIComponent).join('/')
// GitHub Release sanitizes asset names: spaces -> '.', '+' kept. Mirror that for URLs.
const releaseUrl = (fname) => `${releaseBase}/${encodeURIComponent(fname.replace(/ /g, '.'))}`

const slug = (s) => s.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9.+_-]/g, '_')

// ---- Fabric loader ----
// The Fabric loader's own dependencies (asm, sponge-mixin, intermediary, ...) live inside the
// fabric profile JSON in FABRIC format ({name, url:<maven-base>}), which Helios does NOT download.
// Helios only downloads + classpaths modules declared in the distribution, so we must emit each of
// those libraries as a `Library` submodule (this is exactly what Nebula does).
const mavenToPath = (name) => {
  const [g, a, v] = name.split(':')
  return `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}.jar`
}
const fabricManifest = readJson(`fabric-${CONFIG.fabricLoader}-${CONFIG.mcVersion}.json`)
const fabricLibModules = fabricManifest.libraries
  .filter((l) => !l.name.startsWith('net.fabricmc:fabric-loader:')) // the parent Fabric module IS the loader
  .map((l) => ({
    id: l.name,
    name: l.name.split(':')[1],
    type: 'Library',
    artifact: {
      size: l.size,
      MD5: l.md5,
      url: (l.url || 'https://maven.fabricmc.net/') + mavenToPath(l.name),
    },
  }))

const fabricModule = {
  id: `net.fabricmc:fabric-loader:${CONFIG.fabricLoader}`,
  name: 'Fabric Loader',
  type: 'Fabric',
  artifact: {
    size: CONFIG.fabricLoaderSize, MD5: CONFIG.fabricLoaderMD5,
    url: `https://maven.fabricmc.net/net/fabricmc/fabric-loader/${CONFIG.fabricLoader}/fabric-loader-${CONFIG.fabricLoader}.jar`,
  },
  subModules: [
    {
      // NOTE: this id becomes a folder name (common/versions/<id>/<id>.json), so it must be
      // filesystem-safe (no ':'). Use the fabric profile's own id, e.g. fabric-loader-0.19.3-1.21.1.
      id: `fabric-loader-${CONFIG.fabricLoader}-${CONFIG.mcVersion}`,
      name: 'Fabric (Version Manifest)',
      type: 'VersionManifest',
      artifact: {
        size: CONFIG.versionManifestSize, MD5: CONFIG.versionManifestMD5,
        url: `${rawBase}/fabric-${CONFIG.fabricLoader}-${CONFIG.mcVersion}.json`,
      },
    },
    ...fabricLibModules,
  ],
}

// ---- mods -> FabricMod (managed, from Release) ----
const modModules = mods.map((m) => ({
  id: `pokevillage.mods:${slug(m.name)}:1.0.0`,
  name: m.name.replace(/\.jar$/i, ''),
  type: 'FabricMod',
  artifact: { size: m.size, MD5: m.md5, url: releaseUrl(m.name), path: m.name },
}))

// ---- config/** -> File (managed, from repo raw, folder structure preserved) ----
// ---- resourcepacks/* -> File (from Release; big/optional per CONFIG) ----
// ---- options.txt / servers.dat -> File (seed once: no MD5) ----
const fileModules = extra.map((e) => {
  const base = { id: `pokevillage.files:${slug(e.path)}:1.0.0`, name: e.path, type: 'File' }
  if (e.category === 'config') {
    return { ...base, artifact: { size: e.size, MD5: e.md5, url: `${rawBase}/${enc(e.path)}`, path: e.path } }
  }
  if (e.category === 'resourcepack') {
    const fname = e.path.replace(/^resourcepacks\//, '')
    const mod = { ...base, artifact: { size: e.size, MD5: e.md5, url: releaseUrl(fname), path: e.path } }
    if (CONFIG.optionalResourcepacks.includes(fname)) mod.required = { value: false, def: false }
    return mod
  }
  // root files (options.txt, servers.dat) -> seed once, no MD5
  return { ...base, artifact: { size: e.size, url: `${rawBase}/${enc(e.path)}`, path: e.path } }
})

const distribution = {
  version: '1.0.0',
  discord: { clientId: 'CHANGE_ME', smallImageText: 'PokeVillage', smallImageKey: 'logo' },
  rss: '',
  servers: [{
    id: CONFIG.serverId,
    name: CONFIG.serverName,
    description: '포켓빌리지 서버',
    icon: `${rawBase}/icon.png`,
    version: CONFIG.serverVersion,
    address: CONFIG.serverAddress,
    minecraftVersion: CONFIG.mcVersion,
    discord: { shortId: 'PokeVillage', largeImageText: 'PokeVillage', largeImageKey: 'server' },
    mainServer: true,
    autoconnect: true,
    modules: [fabricModule, ...modModules, ...fileModules],
  }],
}

fs.writeFileSync(path.join(SCRATCH, 'distribution.json'), JSON.stringify(distribution, null, 2))

const byType = {}
for (const m of distribution.servers[0].modules) byType[m.type] = (byType[m.type] || 0) + 1
const optCount = fileModules.filter((m) => m.required && m.required.value === false).length
console.log('Wrote distribution.json')
console.log('  modules by type:', JSON.stringify(byType))
console.log('  optional (off by default):', optCount)
