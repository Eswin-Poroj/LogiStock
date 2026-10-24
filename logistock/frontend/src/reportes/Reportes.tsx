import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega } from '../dominio/tipos'
import { csvConBom } from './csv'
import type { AlertaStock, FilaVendida, ResumenReporte } from './leerReportes'
import { esAlertas, esResumen, esVendidos } from './leerReportes'

type Vista = 'resumen' | 'vendidos' | 'alertas'
type Fallo = ApiError | 'formato' | null

function etiquetaAlerta(estado: AlertaStock['estado']): 'Reponer' | 'Agotado' {
  return estado === 'reponer' ? 'Reponer' : 'Agotado'
}

export function Reportes() {
  const { token } = useSesion()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [reporte, setReporte] = useState<Vista>('resumen')
  const [bodegaId, setBodegaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [resumen, setResumen] = useState<ResumenReporte | null>(null)
  const [vendidos, setVendidos] = useState<FilaVendida[] | null>(null)
  const [alertas, setAlertas] = useState<AlertaStock[] | null>(null)
  const [falloResumen, setFalloResumen] = useState<Fallo>(null)
  const [falloVendidos, setFalloVendidos] = useState<Fallo>(null)
  const [falloAlertas, setFalloAlertas] = useState<Fallo>(null)
  const verResumen = reporte === 'resumen'
  const verVendidos = reporte === 'resumen' || reporte === 'vendidos'
  const verAlertas = reporte === 'resumen' || reporte === 'alertas'
  const hayDatos = resumen !== null || vendidos !== null || alertas !== null

  useEffect(() => {
    if (!token) return
    let vivo = true
    async function cargar<T>(ruta: string, guardar: (dato: T) => void, setFallo: (fallo: Fallo) => void, guard: (valor: unknown) => valor is T) {
      try {
        const cuerpo = await api<unknown>(ruta, { token })
        if (!vivo) return
        if (guard(cuerpo)) guardar(cuerpo)
        else setFallo('formato')
      } catch (fallo) {
        if (vivo && fallo instanceof ApiError) setFallo(fallo)
      }
    }
    void cargar('/reportes/resumen', setResumen, setFalloResumen, esResumen)
    void cargar('/reportes/mas-vendidos', setVendidos, setFalloVendidos, esVendidos)
    void cargar('/reportes/alertas-stock', setAlertas, setFalloAlertas, esAlertas)
    return () => { vivo = false }
  }, [token])

  function exportar() {
    const filas: string[][] = [['SKU', 'PRODUCTO', 'UNIDADES', 'DISPONIBLE', 'ESTADO']]
    if (verVendidos && vendidos) {
      for (const fila of vendidos) filas.push([fila.sku, fila.producto, String(fila.unidades), '', ''])
    }
    if (verAlertas && alertas) {
      for (const fila of alertas) filas.push([fila.sku, fila.producto, '', String(fila.disponible), etiquetaAlerta(fila.estado)])
    }
    const blob = new Blob([csvConBom(filas)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'logistock-reportes.csv'
    enlace.click()
    enlace.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="pantalla">
      <h1>Reportes</h1>
      <div className="filtros filtros-reporte">
        <label>
          Reporte
          <select value={reporte} onChange={(evento) => setReporte(evento.target.value as Vista)}>
            <option value="resumen">Resumen operativo</option>
            <option value="vendidos">Productos más vendidos</option>
            <option value="alertas">Alertas de stock</option>
          </select>
        </label>
        <label>
          Bodega
          <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
            <option value="">Todas las bodegas</option>
            {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} />
        </label>
        <button type="button" className="boton-primario" disabled={!hayDatos} onClick={exportar}>Exportar a Excel</button>
      </div>
      {verResumen && (
        <section className="bloque-reporte" aria-label="Resumen">
          <h2>Resumen</h2>
          {falloResumen instanceof ApiError && <AvisoApi error={falloResumen} />}
          {falloResumen === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
          {resumen && (
            <>
              <div className="metricas">
                <div className="metrica"><span>Despachados</span><p>{resumen.pedidos_despachados}</p></div>
                <div className="metrica"><span>A tiempo</span><p>{resumen.entregas_a_tiempo_pct} %</p></div>
                <div className="metrica"><span>Rotación</span><p>{resumen.rotacion}x</p></div>
                <div className="metrica"><span>Backorder</span><p>{resumen.pedidos_backorder}</p></div>
              </div>
              {resumen.despachos_por_dia.length > 0 && (
                <div className="serie-dias">
                  {resumen.despachos_por_dia.map((dia) => (
                    <div className="barra-dia" key={dia.etiqueta}>
                      <div style={{ height: `${dia.cantidad}px` }} />
                      <span>{dia.etiqueta}</span>
                      <span>{dia.cantidad}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {verVendidos && (
        <section className="bloque-reporte" aria-label="Más vendidos">
          <h2>Más vendidos</h2>
          {falloVendidos instanceof ApiError && <AvisoApi error={falloVendidos} />}
          {falloVendidos === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
          {vendidos && (
            <ul className="lista-reporte">
              {vendidos.map((fila) => (
                <li key={fila.sku}><span>{fila.sku}</span> {fila.producto} <span>{fila.unidades}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
      {verAlertas && (
        <section className="bloque-reporte" aria-label="Alertas de stock">
          <h2>Alertas de stock</h2>
          {falloAlertas instanceof ApiError && <AvisoApi error={falloAlertas} />}
          {falloAlertas === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
          {alertas && (
            <ul className="lista-reporte">
              {alertas.map((fila) => (
                <li key={fila.sku}><span>{fila.sku}</span> {fila.producto} {fila.disponible} <span className={fila.estado === 'reponer' ? 'etiqueta-alerta' : 'etiqueta-agotado'}>{etiquetaAlerta(fila.estado)}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  )
}
