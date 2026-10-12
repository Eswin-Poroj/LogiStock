// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('README', () => {
  it('explica cómo correr la interfaz sin marcar los PU como aprobados', () => {
    const texto = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(texto).toContain('Node 20')
    expect(texto).toContain('cd logistock/frontend')
    expect(texto).toContain('npm install')
    expect(texto).toContain('npm test')
    expect(texto).toContain('npm run dev')
    expect(texto).toContain('http://127.0.0.1:3000/api/v1')
    expect(texto).toContain('No cambies PU-01, PU-02, PU-03 ni PU-04 a Aprobado')
    expect(texto).toContain('retryCount')
    expect(texto).toContain('retryDelay')
    expect(texto).toContain('retryJitter')
    expect(texto).toContain('LOCK_TTL_MS')
    expect(texto).not.toContain('lrjoozqkydvzptuzskjz')
  })
})
