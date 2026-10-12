export interface RespuestaMock {
  status: number
  body: unknown
}

export function instalarFetch(handler: (url: string, init?: RequestInit) => RespuestaMock) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const anterior = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    llamadas.push({ url, init })
    const resultado = handler(url, init)
    return new Response(JSON.stringify(resultado.body), {
      status: resultado.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return {
    llamadas,
    restaurar() {
      globalThis.fetch = anterior
    },
  }
}
