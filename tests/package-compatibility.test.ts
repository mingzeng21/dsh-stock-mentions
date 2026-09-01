import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as {
  dsh: { client: { inject: string[] } }
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}

describe('DSH v0.1.2-alpha package contract', () => {
  it('does not advertise the removed client runtime package', () => {
    expect(packageJson.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-runtime')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-runtime']).toBeUndefined()
    expect(packageJson.devDependencies['@deepseek-ai/dsh-client-runtime']).toBeUndefined()
  })

  it('uses current DSH package versions for the client surface', () => {
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-connection']).toBe('^0.1.2-alpha.1')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-locale']).toBe('^0.1.2-alpha.1')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-ui-layout']).toBe('^0.1.2-alpha.1')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-client-ui-chat']).toBe('^0.1.2-alpha.1')
    expect(packageJson.peerDependencies['@deepseek-ai/dsh-session']).toBe('^0.1.2-alpha.1')
  })

  it('loads ui-chat so the alpha.3 assistant action slot can activate', () => {
    expect(packageJson.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-chat')
    expect(packageJson.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-renderer')
  })
})
