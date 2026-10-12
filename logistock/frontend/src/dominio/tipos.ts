export type Rol = 'administrador' | 'asesor_ventas' | 'operario_bodega' | 'despachador'

export function esRol(valor: string): valor is Rol {
  return (
    valor === 'administrador' ||
    valor === 'asesor_ventas' ||
    valor === 'operario_bodega' ||
    valor === 'despachador'
  )
}

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
  bodega_id: string | null
}

export interface LoginResponse {
  access_token: string
  expira_en: number
  usuario: Usuario
}

export interface ErrorCuerpo {
  statusCode: number
  message: string | string[]
  error?: string
}

export interface LineaSinStock {
  producto_id: string
  sku: string
  solicitado: number
  disponible: number
}

export interface Cliente {
  id: string
  nombre: string
  nit: string
  telefono?: string
  direccion?: string
  municipio?: string
  latitud?: number
  longitud?: number
}

export interface Producto {
  id: string
  sku: string
  nombre: string
  unidad: string
  precio_unitario: number
  stock_minimo: number
  activo: boolean
}

export interface Bodega {
  id: string
  nombre: string
  direccion?: string
  latitud?: number
  longitud?: number
}

export interface Vehiculo {
  id: string
  nombre: string
  placa?: string
  capacidad_kg?: number
}

export interface Conductor {
  id: string
  nombre: string
  telefono?: string
}

export type EstadoStock = 'normal' | 'stock_bajo' | 'agotado'

export interface Existencia {
  producto_id: string
  sku: string
  nombre: string
  ubicacion: string
  disponible: number
  reservado: number
  en_transito: number
  danado: number
  estado: EstadoStock
}

export interface InventarioRespuesta {
  totales: { disponible: number; reservado: number; en_transito: number; danado: number }
  items: Existencia[]
}

export interface Movimiento {
  id: string
  producto_id: string
  bodega_id: string
  tipo: 'entrada' | 'reserva' | 'liberacion' | 'despacho' | 'ajuste' | 'danio' | 'transferencia'
  cantidad: number
  referencia?: string
  created_at: string
}

export interface EntradaNueva {
  proveedor_id: string
  bodega_id: string
  lineas: { producto_id: string; cantidad: number }[]
}

export interface Recepcion {
  id: string
  codigo: string
  estado: 'pendiente' | 'recibida' | 'cancelada'
  created_at: string
}

export interface AjusteNuevo {
  producto_id: string
  bodega_id: string
  tipo: 'ajuste' | 'danio'
  cantidad: number
  motivo?: string
}

export type PoliticaFaltantes = 'rechazar' | 'backorder'
export type EstadoPedido = 'creado' | 'en_preparacion' | 'despachado' | 'entregado' | 'cancelado'
export type EstadoLinea = 'reservada' | 'backorder'
export type EstadoPicking = 'pendiente' | 'en_curso' | 'completado' | 'con_faltante'
export type EstadoDespacho = 'planificado' | 'en_ruta' | 'finalizado' | 'cancelado'

export interface PedidoNuevo {
  cliente_id: string
  bodega_id: string
  politica_faltantes: PoliticaFaltantes
  lineas: { producto_id: string; cantidad: number }[]
}

export interface LineaPedido {
  id: string
  producto_id: string
  sku: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  estado: EstadoLinea
}

export interface Pedido {
  id: string
  numero: string
  cliente: string
  estado: EstadoPedido
  total: number
  created_at: string
  bodega_id: string
  subtotal: number
  iva: number
  lineas: LineaPedido[]
}

export interface LineaTareaPicking {
  pedido_linea_id: string
  sku: string
  nombre: string
  cantidad: number
  cantidad_recogida: number
  ubicacion?: string
}

export interface TareaPicking {
  id: string
  pedido_id: string
  estado: EstadoPicking
  numero_pedido?: string
  cliente?: string
  operario?: string | null
  lineas: LineaTareaPicking[]
}

export interface EscaneoNuevo {
  sku: string
  cantidad: number
}

export interface CompletarPicking {
  faltante: boolean
  nota?: string
}

export interface RutaSolicitud {
  bodega_id: string
  pedido_ids: string[]
}

export interface ParadaRuta {
  orden: number
  pedido_id: string
  cliente: string
  direccion: string
  eta: string
}

export interface Ruta {
  distancia_km: number
  duracion_min: number
  proveedor: 'osrm' | 'google'
  paradas: ParadaRuta[]
}

export interface DespachoNuevo {
  vehiculo_id: string
  conductor_id: string
  bodega_id: string
  paradas: { pedido_id: string; orden: number; eta?: string }[]
}

export interface ParadaDespacho {
  id: string
  orden: number
  pedido_id: string
  eta?: string
  entregada_at?: string
}

export interface Despacho {
  id: string
  codigo: string
  estado: EstadoDespacho
  vehiculo: string
  conductor: string
  distancia_km?: number
  duracion_min?: number
  paradas: ParadaDespacho[]
}
