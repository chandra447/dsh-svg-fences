// Static checks that run in CI without a browser.
import { readFileSync, existsSync, statSync } from 'node:fs'

const repo = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, repo), 'utf8')
const failures = []
const check = (ok, label) => {
  if (!ok) failures.push(label)
}

const pkg = JSON.parse(read('package.json'))
const client = read('client.js')
const template = read('src/client.template.js')
const patch = read('cordis.patch.yml')
const index = read('index.js')

check(/^dsh-[a-z0-9-]+$/.test(pkg.name), `package name looks wrong: ${pkg.name}`)
check(pkg.private !== true, 'package is marked private')
check(pkg.license === 'MIT', 'license is not MIT')
check(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch is not declared')
check(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform is not web')
check(pkg.dsh?.client?.immediately === true, 'dsh.client.immediately is not true')
check(existsSync(new URL(pkg.dsh?.bundle?.patch || 'missing', repo)), 'bundle patch file is missing')

check(patch.includes('insert:'), 'patch has no insert operation')
check(patch.includes(`name: ${pkg.name}`), 'patch does not reference the package name')

check(/export function apply/.test(index), 'index.js does not export apply()')

check(client.includes('window.__ModuleLoader__.load('), 'client.js is not a DSH client module')
check(client.includes(`id: '${pkg.name}'`), 'client module id does not match the package name')
check(client === template, 'client.js is stale: run npm run build')
check(statSync(new URL('client.js', repo)).size < 400_000, 'client.js is unexpectedly large')
check(!/\brequire\(/.test(client), 'client.js calls require()')
check(!/\bfetch\(/.test(client), 'client.js calls fetch()')

for (const locale of ['en', 'zh']) {
  const file = `locale/${locale}.json`
  check(existsSync(new URL(file, repo)), `missing ${file}`)
  if (!existsSync(new URL(file, repo))) continue
  const data = JSON.parse(read(file))
  check(typeof data.meta?.title === 'string' && data.meta.title.length > 0, `${file} has no title`)
  check(
    typeof data.meta?.description === 'string' && data.meta.description.length > 0,
    `${file} has no description`,
  )
}

check(existsSync(new URL('LICENSE', repo)), 'missing LICENSE')
check(existsSync(new URL('icon.svg', repo)), 'missing icon.svg')

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}

console.log(`verify: ${pkg.name} passed all checks`)
