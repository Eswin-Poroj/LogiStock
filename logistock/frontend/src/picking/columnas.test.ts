import { describe, expect, it } from 'vitest'
import { agruparTareas, columnaDeTarea, tituloColumna } from './columnas'

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
})
