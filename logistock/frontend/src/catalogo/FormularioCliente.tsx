import { useState } from 'react'
import type { FormEvent } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Cliente } from '../dominio/tipos'
import { SelectorUbicacion } from './SelectorUbicacion'

/** Alta de cliente. Las coordenadas son las que usa el motor de rutas para la entrega (CU-06). */
export function FormularioCliente({ onCreado }: { onCreado: (cliente: Cliente) => void }) {
  const { token } = useSesion()
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [punto, setPunto] = useState<{ latitud: number; longitud: number } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const listo = nombre.trim() !== '' && nit.trim() !== ''

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!token || !listo) return
    setError(null)
    const body: Record<string, unknown> = { nombre: nombre.trim(), nit: nit.trim() }
    if (telefono.trim()) body.telefono = telefono.trim()
    if (direccion.trim()) body.direccion = direccion.trim()
    if (municipio.trim()) body.municipio = municipio.trim()
    if (punto) { body.latitud = punto.latitud; body.longitud = punto.longitud }
    try {
      const creado = await api<Cliente>('/clientes', { method: 'POST', token, body })
      onCreado(creado)
      for (const limpiar of [setNombre, setNit, setTelefono, setDireccion, setMunicipio]) limpiar('')
      setPunto(null)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <form className="campos-catalogo" aria-label="Nuevo cliente" onSubmit={(evento) => void enviar(evento)}>
      {error && <AvisoApi error={error} />}
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>NIT<input value={nit} onChange={(e) => setNit(e.target.value)} /></label>
      <label>Teléfono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></label>
      <SelectorUbicacion
        latitud={punto?.latitud ?? null}
        longitud={punto?.longitud ?? null}
        onCambio={(lugar) => {
          setPunto({ latitud: lugar.latitud, longitud: lugar.longitud })
          if (lugar.direccion) setDireccion(lugar.direccion)
          if (lugar.municipio) setMunicipio(lugar.municipio)
        }}
      />
      <label>Dirección<input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
      <label>Municipio<input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></label>
      {!punto && <p className="nota">Sin ubicación marcada el cliente no se puede incluir en una ruta de despacho.</p>}
      <button type="submit" className="boton-primario" disabled={!listo}>Guardar cliente</button>
    </form>
  )
}
