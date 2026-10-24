import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { csvConBom } from './csv'
import type { AlertaStock, FilaVendida, ResumenReporte } from './leerReportes'
import { conFiltros, esAlertas, esResumen, esVendidos, etiquetaDia } from './leerReportes'

type Vista = 'resumen' | 'vendidos' | 'alertas'
type Fallo = ApiError | 'formato' | null

function etiquetaAlerta(estado: AlertaStock['estado']): 'Reponer' | 'Agotado' {
  return estado === 'stock_bajo' ? 'Reponer' : 'Agotado'
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
    setFalloResumen(null)
    setFalloVendidos(null)
    setFalloAlertas(null)
    void cargar(conFiltros('/reportes/resumen', { bodega_id: bodegaId, desde, hasta }), setResumen, setFalloResumen, esResumen)
    void cargar(conFiltros('/reportes/mas-vendidos', { desde, hasta, limite: '5' }), setVendidos, setFalloVendidos, esVendidos)
    void cargar(conFiltros('/reportes/alertas-stock', { bodega_id: bodegaId }), setAlertas, setFalloAlertas, esAlertas)
    return () => { vivo = false }
  }, [token, bodegaId, desde, hasta])

  function exportar() {
    const filas: string[][] = [['SKU', 'PRODUCTO', 'UNIDADES', 'DISPONIBLE', 'ESTADO']]
    if (verVendidos && vendidos) {
      for (const fila of vendidos) filas.push([fila.sku, fila.nombre, String(fila.unidades), '', ''])
    }
    if (verAlertas && alertas) {
      for (const fila of alertas) filas.push([fila.sku, fila.nombre, '', String(fila.disponible), etiquetaAlerta(fila.estado)])
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

  const maximoDia = Math.max(1, ...(resumen?.despachos_por_dia ?? []).map((dia) => dia.cantidad))

  return (
    <section className="pantalla">
      <Encabezado titulo="Reportes">
        <button type="button" disabled={!hayDatos} onClick={exportar}>Exportar a Excel</button>
      </Encabezado>
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
      </div>
      {verResumen && (
        <section aria-label="Resumen">
          {falloResumen instanceof ApiError && <AvisoApi error={falloResumen} />}
          {falloResumen === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
          {resumen && (
        <div className="metricas">
          <div className="metrica"><span>Pedidos despachados</span><p>{resumen.pedidos_despachados}</p><small>en el período</small></div>
          <div className="metrica"><span>Entregas a tiempo</span><p>{resumen.entregas_a_tiempo_pct} %</p><small>del total entregado</small></div>
          <div className="metrica"><span>Rotación de inventario</span><p>{resumen.rotacion_inventario}x</p><small>veces en el período</small></div>
          <div className="metrica"><span>Pedidos con backorder</span><p>{resumen.pedidos_con_backorder}</p><small>con líneas pendientes</small></div>
        </div>
          )}
        </section>
      )}
      <div className="reportes-cuerpo">
        {verResumen && (
          <section className="tarjeta bloque-grafica" aria-labelledby="titulo-grafica">
            <h2 id="titulo-grafica">Pedidos despachados por día</h2>
            {resumen && resumen.despachos_por_dia.every((dia) => dia.cantidad === 0) && <p className="nota">Sin despachos en el período.</p>}
            {resumen && resumen.despachos_por_dia.some((dia) => dia.cantidad > 0) && (
              <div className="serie-dias">
                {resumen.despachos_por_dia.map((dia) => (
                  <div className="barra-dia" key={dia.fecha}>
                    <div style={{ height: `${(dia.cantidad / maximoDia) * 85}%` }} />
                    <span className="dia">{etiquetaDia(dia.fecha)}</span>
                    <span className="valor">{dia.cantidad}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        <div className="reportes-lateral">
          {verVendidos && (
            <section className="tarjeta bloque-reporte" aria-label="Más vendidos">
              <h2>Productos más vendidos</h2>
              {falloVendidos instanceof ApiError && <AvisoApi error={falloVendidos} />}
              {falloVendidos === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
              {vendidos && (
                <div className="tabla-contenedor">
                  <table>
                    <thead><tr><th>SKU</th><th>Producto</th><th className="num">Unidades</th></tr></thead>
                    <tbody>
                      {vendidos.map((fila) => (
                        <tr key={fila.sku}><td className="sku">{fila.sku}</td><td>{fila.nombre}</td><td className="num">{fila.unidades}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {verAlertas && (
            <section className="tarjeta bloque-reporte" aria-label="Alertas de stock">
              <h2>Alertas de stock</h2>
              {falloAlertas instanceof ApiError && <AvisoApi error={falloAlertas} />}
              {falloAlertas === 'formato' && <p role="alert">El servicio no devolvió el formato esperado.</p>}
              {alertas && (
                <div className="tabla-contenedor">
                  <table>
                    <thead><tr><th>SKU</th><th>Producto</th><th className="num">Disp.</th><th>Estado</th></tr></thead>
                    <tbody>
                      {alertas.map((fila) => (
                        <tr key={fila.sku}>
                          <td className="sku">{fila.sku}</td>
                          <td>{fila.nombre}</td>
                          <td className="num">{fila.disponible}</td>
                          <td><span className={fila.estado === 'stock_bajo' ? 'etiqueta-alerta' : 'etiqueta-agotado'}>{etiquetaAlerta(fila.estado)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
