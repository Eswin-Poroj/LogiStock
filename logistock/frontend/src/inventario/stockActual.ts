import { api } from '../api/cliente'
import type { Existencia, InventarioRespuesta } from '../dominio/tipos'

/** CU-04 paso 6: tras el movimiento se vuelve a leer la existencia para mostrar el stock real. */
export async function stockActual(token: string, productoId: string, bodegaId: string): Promise<Existencia | null> {
  const inventario = await api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
  return inventario.items.find((item) => item.producto_id === productoId) ?? null
}
