import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const packageJson = readJson('package.json')
const requiredFiles = [
  'lib/index.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'cordis.patch.yml',
]

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) throw new Error(`缺少构建产物：${file}`)
}

assert(packageJson.name === 'dsh-stock-mentions', 'package name 不匹配')
assert(packageJson.main === 'lib/index.js', 'main 必须指向 lib/index.js')
assert(packageJson.types === 'lib/types/index.d.ts', 'types 必须指向 lib/types/index.d.ts')
for (const exportName of ['.', './client', './cordis.patch.yml']) {
  assert(packageJson.exports?.[exportName] !== undefined, `缺少 exports.${exportName}`)
}

const patch = readText('cordis.patch.yml')
assert(/id:\s*stock-mentions\b/u.test(patch), 'bundle patch 缺少 stock-mentions id')
assert(/name:\s*dsh-stock-mentions\b/u.test(patch), 'bundle patch 缺少插件名称')

const serverEntry = readText('lib/index.js')
const clientEntry = readText('lib/client.js')
assert(/export const name\s*=\s*['"]dsh-stock-mentions['"]/u.test(serverEntry), 'Host bundle 未导出插件名称')
assert(clientEntry.includes('window.__ModuleLoader__.load'), 'Client bundle 未注册 ModuleLoader')
assert(clientEntry.includes('dsh-stock-mentions'), 'Client bundle 未包含插件 id')
assert(!/(?:from\s+|require\()['"][^'"]+\.ts['"]/.test(clientEntry), 'Client bundle 仍引用 TypeScript 源文件')

verifyEntrypoints()
verifyPackedFiles()
console.log(`verified ${packageJson.name}@${packageJson.version}`)

function verifyEntrypoints() {
  const program = [
    "const server = await import('./lib/index.js')",
    "if (server.name !== 'dsh-stock-mentions' || typeof server.apply !== 'function') throw new Error('Host entry 导出无效')",
    'const registrations = []',
    'globalThis.window = { __ModuleLoader__: { load: value => registrations.push(value) } }',
    "await import('./lib/client.js?package-verify')",
    "if (registrations.length !== 1 || registrations[0]?.id !== 'dsh-stock-mentions' || typeof registrations[0]?.factory !== 'function') throw new Error('Client entry 注册无效')",
  ].join(';')
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) throw new Error(`入口校验失败：${result.stderr.trim() || result.stdout.trim()}`)
}

function verifyPackedFiles() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'dsh-stock-mentions-package-'))
  try {
    const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: join(temporaryDirectory, 'npm-cache') },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (result.status !== 0) throw new Error(`npm pack 校验失败：${result.stderr.trim() || result.stdout.trim()}`)
    const report = JSON.parse(result.stdout)
    const files = report[0]?.files
    if (!Array.isArray(files)) throw new Error('npm pack 未返回文件清单')
    const paths = files.map(file => file?.path).filter(path => typeof path === 'string')
    for (const required of ['package.json', ...requiredFiles]) {
      if (!paths.includes(required)) throw new Error(`发布包缺少文件：${required}`)
    }
    const leaked = paths.filter(path => /^(?:src|tests|scripts|node_modules)(?:\/|$)/u.test(path))
    if (leaked.length > 0) throw new Error(`发布包包含开发目录：${leaked.join(', ')}`)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

function readText(file) {
  return readFileSync(resolve(root, file), 'utf8')
}

function readJson(file) {
  return JSON.parse(readText(file))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
