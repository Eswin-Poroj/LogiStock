import { describe, expect, it } from 'vitest'
import { agruparTareas, columnaDeTarea, progresoTarea, tituloColumna } from './columnas'

describe('columnas de picking', () => {
  it('deja en Creado solo la tarea pendiente', () => {
    expect(columnaDeTarea('pendiente')).toBe('creado')
    expect(columnaDeTarea('en_curso')).toBe('en_preparacion')
    expect(columnaDeTarea('completado')).toBe('en_preparacion')
    expect(columnaDeTarea('con_faltante')).toBe('en_preparacion')
  })

  it('titula las columnas como el mockup', () => {
    expect(tituloColumna('creado')).toBe('Creado')
    expect(tituloColumna('en_preparacion')).toBe('En preparación')
    expect(tituloColumna('despachado')).toBe('Despachado')
    expect(tituloColumna('entregado')).toBe('Entregado')
  })

  it('agrupa sin perder tareas', () => {
    const grupos = agruparTareas([
      { id: 'a', estado: 'pendiente' },
      { id: 'b', estado: 'en_curso' },
      { id: 'c', estado: 'completado' },
    ])
    expect(grupos.creado.map((tarea) => tarea.id)).toEqual(['a'])
    expect(grupos.en_preparacion.map((tarea) => tarea.id)).toEqual(['b', 'c'])
  })

  it('no repite como tarea el pedido que ya se despachó o entregó', () => {
    const grupos = agruparTareas([
      { id: 'a', estado: 'completado', estado_pedido: 'en_preparacion' },
      { id: 'b', estado: 'completado', estado_pedido: 'despachado' },
      { id: 'c', estado: 'completado', estado_pedido: 'entregado' },
    ])
    expect(grupos.en_preparacion.map((tarea) => tarea.id)).toEqual(['a'])
    expect(grupos.creado).toEqual([])
  })

  it('muestra el avance por líneas solo mientras la tarea está en curso', () => {
    const lineas = [{ cantidad: 40, cantidad_recogida: 40 }, { cantidad: 25, cantidad_recogida: 10 }]
    expect(progresoTarea({ estado: 'en_curso', lineas })).toBe('Picking en curso · 1 de 2')
    expect(progresoTarea({ estado: 'pendiente', lineas })).toBeNull()
    expect(progresoTarea({ estado: 'completado', lineas })).toBeNull()
  })
})
