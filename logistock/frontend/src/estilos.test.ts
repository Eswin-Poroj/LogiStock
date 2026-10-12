import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('PU-04', () => {
  it('la página no se desplaza en horizontal y los controles miden 44 px', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'estilos.css'), 'utf8')
    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)
    document.body.innerHTML = '<div id="root"><button type="button" disabled>Confirmar pedido</button><a href="/pedidos">Pedidos</a><div class="tabla-contenedor"><span class="ancho">x</span></div></div>'
    const boton = document.querySelector('button')!
    const enlace = document.querySelector('a')!
    expect(css).toContain('overflow-x: hidden')
    expect(css).toContain('max-width: 100%')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('min-width: 44px')
    expect(css).toContain('.tabla-contenedor')
    expect(getComputedStyle(document.documentElement).overflowX).toBe('hidden')
    expect(getComputedStyle(boton).minHeight).toBe('44px')
    expect(getComputedStyle(boton).minWidth).toBe('44px')
    expect(getComputedStyle(enlace).minHeight).toBe('44px')
    expect(css).not.toMatch(/min-width:\s*\d{4,}px/)
  })
})
