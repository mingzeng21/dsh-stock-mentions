import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as {
  dsh: { client: { inject: string[] } }
  engines: { node: string }
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const hostEntry = readFileSync(resolve(import.meta.dirname, '../src/index.ts'), 'utf8')
const hostBundle = readFileSync(resolve(import.meta.dirname, '../lib/index.js'), 'utf8')

describe('DSH v0.1.7-rc.2 package contract', () => {
  it('does not advertise the removed client runtime package', () => {
    expect(packageJson.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-runtime')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-runtime']).toBeUndefined()
    expect(packageJson.devDependencies['@deepseek-ai/dsh-client-runtime']).toBeUndefined()
  })

  it('keeps the previous DSH peer range and tests against the verified release', () => {
    for (const name of [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-chat',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-session',
    ]) {
      expect(packageJson.peerDependencies[name]).toBe('^0.1.5-alpha.1 || ^0.1.7-rc.2')
      expect(packageJson.devDependencies[name]).toBe('^0.1.7-rc.2')
    }
    expect(packageJson.devDependencies['@deepseek-ai/cordis']).toBe('^4.0.4')
    expect(packageJson.engines.node).toBe('^22.19.0 || >=24.0.0')
  })

  it('loads ui-chat so the assistant action slot can activate', () => {
    expect(packageJson.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-chat')
    expect(packageJson.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-renderer')
  })

  it('declares webServer for the Host RPC route owner', () => {
    expect(hostEntry).toMatch(/export const inject = \['connection', 'webServer'\]/u)
    expect(hostBundle).toMatch(/export const inject = \['connection', 'webServer'\]/u)
  })
})
