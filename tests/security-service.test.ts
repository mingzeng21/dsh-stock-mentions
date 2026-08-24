import { describe, expect, it } from 'vitest'
import { securityFromSymbol } from '../src/stock-api/service.ts'

describe('securityFromSymbol', () => {
  it('accepts supported Shanghai and Shenzhen ordinary A-share codes', () => {
    expect(securityFromSymbol('600519.SH').exchange).toBe('SSE')
    expect(securityFromSymbol('300750.SZ').exchange).toBe('SZSE')
    expect(securityFromSymbol('688001.SH').market).toBe('SH')
  })

  it('rejects indices and a code with a mismatched market suffix', () => {
    expect(() => securityFromSymbol('399001.SZ')).toThrow()
    expect(() => securityFromSymbol('000001.SH')).toThrow()
  })
})
