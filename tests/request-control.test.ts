import { describe, expect, it } from 'vitest'
import { ProviderGate } from '../src/stock-api/request-control.ts'

describe('ProviderGate', () => {
  it('rejects a queued request when it is cancelled during the start delay', async () => {
    const gate = new ProviderGate(1, 10_000)
    let releaseFirst!: () => void
    const first = gate.run(new AbortController().signal, () => new Promise<string>(resolve => { releaseFirst = () => resolve('first') }))
    await Promise.resolve()
    const secondController = new AbortController()
    const second = gate.run(secondController.signal, async () => 'second')
    secondController.abort()
    releaseFirst()

    await expect(first).resolves.toBe('first')
    await expect(second).rejects.toMatchObject({ code: 'cancelled' })
  })
})
