import { describe, expect, it } from 'vitest'
import { extractCandidates } from '../src/client/annotator.ts'

describe('extractCandidates', () => {
  it('keeps source offsets while excluding links, fences, HTML, math, and URLs', () => {
    const text = '贵州茅台 600519.SH [平安银行](https://example.test/000001) `600000`\n```\n招商银行\n```\n<span>宁德时代</span> $隆基绿能$'
    const candidates = extractCandidates(text, 32)

    expect(candidates).toEqual([
      { candidate: '贵州茅台', start: 0, end: 4 },
      { candidate: '600519.SH', start: 5, end: 14 },
      { candidate: '600000', start: 52, end: 58 },
    ])
  })

  it('limits candidates after sorting by source position', () => {
    expect(extractCandidates('贵州茅台，宁德时代，600519', 2)).toEqual([
      { candidate: '贵州茅台', start: 0, end: 4 },
      { candidate: '宁德时代', start: 5, end: 9 },
    ])
  })

  it('uses UTF-16 offsets when preceding text contains astral characters', () => {
    expect(extractCandidates('😀贵州茅台', 32)).toContainEqual({ candidate: '贵州茅台', start: 2, end: 6 })
  })
})
