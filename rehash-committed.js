// Re-hash the files that are COMMITTED to the repo (config/**, options.txt, servers.dat)
// from the dist working tree, so distribution.json matches exactly what git serves.
// Resourcepack entries (Release-hosted, binary) are preserved from the existing profile_extra.json.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DIST = __dirname
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex')

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else out.push(full)
  }
}

// config/**
const configFiles = []
walk(path.join(DIST, 'config'), configFiles)
const configEntries = configFiles.map((f) => {
  const buf = fs.readFileSync(f)
  const rel = path.relative(DIST, f).split(path.sep).join('/')
  return { category: 'config', path: rel, size: buf.length, md5: md5(buf) }
})

// root text/data files
const rootEntries = ['options.txt', 'servers.dat'].map((n) => {
  const buf = fs.readFileSync(path.join(DIST, n))
  return { category: 'root', path: n, size: buf.length, md5: md5(buf) }
})

// keep resourcepack entries (Release-hosted binaries) from existing profile_extra.json
const existing = JSON.parse(fs.readFileSync(path.join(DIST, 'profile_extra.json'), 'utf8').replace(/^﻿/, ''))
const resourcepackEntries = existing.filter((e) => e.category === 'resourcepack')

const merged = [...configEntries, ...resourcepackEntries, ...rootEntries]
fs.writeFileSync(path.join(DIST, 'profile_extra.json'), JSON.stringify(merged, null, 2))
console.log(`rehashed: config=${configEntries.length}, resourcepack(kept)=${resourcepackEntries.length}, root=${rootEntries.length}`)
