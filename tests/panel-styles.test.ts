import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(resolve(import.meta.dirname, '../src/client/panel/StockMentionPanel.module.css'), 'utf8')

describe('stock mention panel layout contract', () => {
  it('uses the root overlay edge and the DSH-aligned narrow width', () => {
    expect(styles).toContain('right: 0;')
    expect(styles).toContain('--stock-panel-width: 360px;')
    expect(styles).toContain('width: min(var(--stock-panel-width), 100vw);')
    expect(styles).not.toContain('var(--dsh-sidebar-width')
  })

  it('responds to the panel width instead of only the browser viewport', () => {
    expect(styles).toContain('container-type: inline-size;')
    expect(styles).toContain('@container (max-width: 320px)')
    expect(styles).not.toContain('@media (max-width: 780px)')
  })
})
