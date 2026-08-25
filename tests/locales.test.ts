import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'

describe('stock mentions locale dictionaries', () => {
  it('keep Chinese and English dictionaries in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('contains translations for the panel-specific labels', () => {
    expect(zh.marketSH).toBe('沪A')
    expect(en.marketSH).toBe('SH A')
    expect(zh.recent30).toBe('最近30日')
    expect(en.recent30).toBe('Recent 30 days')
  })
})
