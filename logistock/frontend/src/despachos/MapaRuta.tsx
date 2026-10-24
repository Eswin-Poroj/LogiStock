import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Ruta } from '../dominio/tipos'

type Punto = [number, number]

/** Puntos de la ruta en orden de visita, o null si la API no mandó las coordenadas. */
export function puntosDeRuta(ruta: Ruta): { origen: Punto; paradas: Punto[] } | null {
  if (!ruta.origen) return null
  const paradas: Punto[] = []
  for (const parada of ruta.paradas) {
    if (typeof parada.latitud !== 'number' || typeof parada.longitud !== 'number') return null
    paradas.push([parada.latitud, parada.longitud])
  }
  return { origen: [ruta.origen.latitud, ruta.origen.longitud], paradas }
}

function marcador(clase: string, texto: string) {
  return L.divIcon({ className: '', html: `<span class="marcador ${clase}">${texto}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })
}

/** Mapa de la figura 8: bodega, paradas numeradas y el trazo que devuelve el motor de rutas. */
export function MapaRuta({ ruta }: { ruta: Ruta | null }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const puntos = useMemo(() => (ruta ? puntosDeRuta(ruta) : null), [ruta])

  useEffect(() => {
    if (!ruta || !puntos || !contenedor.current) return
    const mapa = L.map(contenedor.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; colaboradores de OpenStreetMap',
    }).addTo(mapa)
    L.marker(puntos.origen, { icon: marcador('marcador-bodega', ''), title: ruta.origen?.nombre }).addTo(mapa)
    puntos.paradas.forEach((punto, indice) => {
      const ultimo = indice === puntos.paradas.length - 1 && puntos.paradas.length > 1
      L.marker(punto, { icon: marcador(ultimo ? 'marcador-ultimo' : '', String(indice + 1)), title: ruta.paradas[indice].cliente }).addTo(mapa)
    })
    const trazo = ruta.trazo && ruta.trazo.length > 1 ? ruta.trazo : [puntos.origen, ...puntos.paradas]
    const linea = L.polyline(trazo, { color: '#2f6fb0', weight: 4 }).addTo(mapa)
    mapa.fitBounds(linea.getBounds(), { padding: [28, 28] })
    return () => { mapa.remove() }
  }, [ruta, puntos])

  if (!ruta) return <div className="mapa-ruta"><p className="mapa-vacio">Elige los pedidos y calcula la ruta para verla en el mapa.</p></div>
  if (!puntos) return <div className="mapa-ruta"><p className="mapa-vacio">El motor no devolvió las coordenadas de la ruta.</p></div>
  return <div className="mapa-ruta" ref={contenedor} role="img" aria-label="Mapa de la ruta propuesta" />
}
