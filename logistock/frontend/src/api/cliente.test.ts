import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AvisoApi } from './AvisoApi'
import { API_BASE_LOCAL, ApiError, api, apiBase } from './cliente'
import { instalarFetch } from '../test/mockFetch'
import { PRODUCTO_ID } from '../test/ids'

describe('cliente HTTP', () => {
  const redes: { restaurar(): void }[] = []

  afterEach(() => {
    for (const red of redes) red.restaurar()
    redes.length = 0
  })

  it('solo acepta la API de 127.0.0.1', () => {
    expect(apiBase(undefined)).toBe(API_BASE_LOCAL)
    expect(apiBase('')).toBe(API_BASE_LOCAL)
    expect(apiBase(`${API_BASE_LOCAL}/`)).toBe(API_BASE_LOCAL)
    expect(() => apiBase('http://localhost:3000/api/v1')).toThrow(API_BASE_LOCAL)
    expect(() => apiBase('https://lrjoozqkydvzptuzskjz.supabase.co')).toThrow(API_BASE_LOCAL)
  })

  it('el ejemplo de entorno y el paquete no apuntan al proyecto alojado ni suben de Node', () => {
    const raiz = process.cwd()
    const ejemplo = readFileSync(`${raiz}/.env.example`, 'utf8')
    const paquete = JSON.parse(readFileSync(`${raiz}/package.json`, 'utf8')) as {
      engines: { node: string }
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const html = readFileSync(`${raiz}/index.html`, 'utf8')
    expect(ejemplo.trim()).toBe(`VITE_API_BASE=${API_BASE_LOCAL}`)
    expect(ejemplo).not.toContain('lrjoozqkydvzptuzskjz')
    expect(paquete.engines.node).toBe('20.x')
    expect(html).toContain('lang="es"')
    for (const nombre of ['@mui/material', 'antd', '@chakra-ui/react', 'bootstrap', 'tailwindcss']) {
      expect(paquete.dependencies?.[nombre]).toBeUndefined()
      expect(paquete.devDependencies?.[nombre]).toBeUndefined()
    }
  })

  it('envía el bearer a la base local y traduce un 501', async () => {
    const red = instalarFetch((url, init) => {
      expect(url).toBe(`${API_BASE_LOCAL}/reportes/resumen`)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-prueba' })
      return { status: 501, body: { statusCode: 501, message: 'Pendiente', error: 'Not Implemented' } }
    })
    redes.push(red)
    await expect(api('/reportes/resumen', { token: 'token-prueba' })).rejects.toMatchObject({
      status: 501,
      message: 'Pendiente',
    })
    expect(red.llamadas).toHaveLength(1)
  })

  it('guarda las líneas sin stock de un 409', async () => {
    const red = instalarFetch(() => ({
      status: 409,
      body: {
        statusCode: 409,
        message: ['Stock insuficiente'],
        error: 'Conflict',
        lineas_sin_stock: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', solicitado: 5, disponible: 0 }],
      },
    }))
    redes.push(red)
    try {
      await api('/pedidos', { method: 'POST', token: 'token-prueba', body: { lineas: [] } })
      throw new Error('debía fallar')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      const apiError = error as ApiError
      expect(apiError.message).toBe('Stock insuficiente')
      expect(apiError.lineasSinStock).toEqual([
        { producto_id: PRODUCTO_ID, sku: 'FER-0012', solicitado: 5, disponible: 0 },
      ])
    }
  })

  it('muestra el status real y no una cifra de ruta', () => {
    render(
      createElement(AvisoApi, {
        error: new ApiError(502, {
          statusCode: 502,
          message: 'El motor de rutas no respondió',
          error: 'Bad Gateway',
        }),
      }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('El servicio respondió 502: El motor de rutas no respondió')
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
  })
})
