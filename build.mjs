import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('.', import.meta.url)
const source = readFileSync(new URL('src/client.template.js', root), 'utf8')
const target = new URL('client.js', root)

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8')
  if (current !== source) {
    console.error('client.js is stale: run `npm run build`')
    process.exit(1)
  }
  console.log('client.js is up to date')
} else {
  writeFileSync(target, source)
  console.log(`client.js written: ${(source.length / 1024).toFixed(1)} KiB`)
}
