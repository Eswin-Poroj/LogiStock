import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buscarDireccion, direccionDe, seisDecimales } from './geocodificar'
import type { Lugar } from './geocodificar'

/** Quetzaltenango, donde está la bodega de referencia. */
const CENTRO: [number, number] = [14.8347, -91.5181]

const ICONO = L.divIcon({ className: '', html: '<span class="marcador marcador-cliente"></span>', iconSize: [26, 26], iconAnchor: [13, 13] })

/**
 * Ubicación de entrega del cliente: se busca la dirección o se marca en el mapa.
 * Al mover el marcador se propone la dirección y el municipio de ese punto.
 */
export function SelectorUbicacion({ latitud, longitud, onCambio }: {
  latitud: number | null
  longitud: number | null
  onCambio: (lugar: Lugar) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const pin = useRef<L.Marker | null>(null)
  const avisar = useRef(onCambio)
  avisar.current = onCambio
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Lugar[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function elegirPunto(lat: number, lng: number) {
    const punto = { latitud: seisDecimales(lat), longitud: seisDecimales(lng) }
    const lugar = await direccionDe(punto.latitud, punto.longitud).catch(() => null)
    avisar.current(lugar ?? { etiqueta: '', direccion: '', municipio: '', ...punto })
  }

  useEffect(() => {
    if (!contenedor.current) return
    let instancia: L.Map
    try {
      instancia = L.map(contenedor.current, { scrollWheelZoom: false }).setView(CENTRO, 13)
    } catch {
      return // sin soporte de mapa (entorno de pruebas): queda la búsqueda por dirección
    }
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; colaboradores de OpenStreetMap' }).addTo(instancia)
    instancia.on('click', (evento: L.LeafletMouseEvent) => { void elegirPunto(evento.latlng.lat, evento.latlng.lng) })
    mapa.current = instancia
    return () => { instancia.remove(); mapa.current = null; pin.current = null }
  }, [])

  useEffect(() => {
    const instancia = mapa.current
    if (!instancia) return
    if (latitud === null || longitud === null) {
      pin.current?.remove()
      pin.current = null
      return
    }
    const punto: [number, number] = [latitud, longitud]
    if (!pin.current) {
      pin.current = L.marker(punto, { icon: ICONO, draggable: true, title: 'Ubicación del cliente' }).addTo(instancia)
      pin.current.on('dragend', () => {
        const destino = pin.current?.getLatLng()
        if (destino) void elegirPunto(destino.lat, destino.lng)
      })
    } else {
      pin.current.setLatLng(punto)
    }
    instancia.setView(punto, Math.max(instancia.getZoom(), 16))
  }, [latitud, longitud])

  async function buscar() {
    if (!texto.trim()) return
    setAviso(null)
    setResultados(null)
    try {
      const encontrados = await buscarDireccion(texto.trim())
      setResultados(encontrados)
      if (encontrados.length === 0) setAviso('No encontramos esa dirección. Prueba con zona y municipio, o marca el punto en el mapa.')
    } catch (fallo) {
      setAviso(fallo instanceof Error ? fallo.message : 'No se pudo buscar la dirección.')
    }
  }

  return (
    <div className="selector-ubicacion">
      <div className="buscador-direccion">
        <label>
          Buscar dirección
          <input
            value={texto}
            placeholder="4a calle 12-30 zona 1, Quetzaltenango"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscar() } }}
          />
        </label>
        <button type="button" disabled={!texto.trim()} onClick={() => void buscar()}>Buscar</button>
      </div>
      {aviso && <p className="nota" role="status">{aviso}</p>}
      {resultados && resultados.length > 0 && (
        <ul className="resultados-direccion" aria-label="Resultados de la búsqueda">
          {resultados.map((lugar) => (
            <li key={`${lugar.latitud},${lugar.longitud}`}>
              <button type="button" onClick={() => { avisar.current(lugar); setResultados(null) }}>{lugar.etiqueta}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mapa-ubicacion" ref={contenedor} role="application" aria-label="Mapa para marcar la ubicación del cliente" />
      <p className="nota">
        {latitud !== null && longitud !== null
          ? <>Ubicación marcada: <strong>{latitud}, {longitud}</strong>. Puedes arrastrar el marcador para afinarla.</>
          : 'Busca la dirección o haz clic en el mapa para marcar dónde se entrega.'}
      </p>
    </div>
  )
}
