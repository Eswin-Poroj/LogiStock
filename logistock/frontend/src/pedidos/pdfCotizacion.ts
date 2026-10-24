import { quetzales } from '../dominio/quetzales'
import type { Cotizacion } from '../dominio/tipos'

/** Filas de la tabla del PDF: una por producto cotizado. Separadas para probarlas sin generar el PDF. */
export function filasCotizacion(c: Cotizacion): string[][] {
  return c.lineas.map((l, i) => [
    String(i + 1),
    l.sku,
    l.nombre,
    String(l.cantidad),
    quetzales(l.precio_unitario),
    quetzales(l.subtotal),
  ])
}

export function nombreArchivo(c: Cotizacion): string {
  return `${c.numero}.pdf`
}

const MARINO: [number, number, number] = [21, 50, 79]
const TINTA_SUAVE: [number, number, number] = [91, 104, 120]

/** Cotización en PDF (tamaño carta): datos del cliente, una fila por producto y totales con IVA. */
export async function descargarPdfCotizacion(c: Cotizacion, ivaPct = 12): Promise<void> {
  // Se cargan al pedir el PDF: jsPDF no viaja en el paquete inicial de la app.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const ancho = doc.internal.pageSize.getWidth()
  const margen = 48

  doc.setFillColor(...MARINO)
  doc.rect(0, 0, ancho, 84, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('LogiStock', margen, 50)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Inventario, picking y rutas', margen, 66)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('COTIZACIÓN', ancho - margen, 46, { align: 'right' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(c.numero, ancho - margen, 64, { align: 'right' })

  doc.setTextColor(23, 33, 46)
  let y = 118
  const dato = (etiqueta: string, valor: string, x: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TINTA_SUAVE)
    doc.text(etiqueta.toUpperCase(), x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(23, 33, 46)
    doc.text(valor || '—', x, y + 15, { maxWidth: 240 })
  }
  dato('Cliente', c.cliente, margen)
  dato('Fecha', new Date(c.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' }), ancho / 2 + 20)
  y += 40
  dato('NIT', c.cliente_nit ?? '', margen)
  dato('Bodega de despacho', c.bodega ?? '', ancho / 2 + 20)
  y += 40
  dato('Dirección', c.cliente_direccion ?? '', margen)
  dato('Asesor', c.asesor ?? '', ancho / 2 + 20)

  autoTable(doc, {
    startY: y + 36,
    margin: { left: margen, right: margen },
    head: [['#', 'SKU', 'Descripción', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: filasCotizacion(c),
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, textColor: [23, 33, 46] },
    headStyles: { fillColor: MARINO, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 72 }, 3: { halign: 'right', cellWidth: 44 }, 4: { halign: 'right', cellWidth: 84 }, 5: { halign: 'right', cellWidth: 88 } },
    // Los encabezados de cantidad y montos se alinean igual que sus valores.
    didParseCell: (celda) => { if (celda.section === 'head' && celda.column.index >= 3) celda.cell.styles.halign = 'right' },
  })

  const finTabla = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  let ty = finTabla + 26
  const total = (etiqueta: string, valor: string, fuerte = false) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal')
    doc.setFontSize(fuerte ? 13 : 11)
    doc.text(etiqueta, ancho - margen - 150, ty)
    doc.text(valor, ancho - margen, ty, { align: 'right' })
    ty += fuerte ? 22 : 18
  }
  total('Subtotal', quetzales(c.subtotal))
  total(`IVA ${ivaPct} %`, quetzales(c.iva))
  doc.setDrawColor(221, 227, 234)
  doc.line(ancho - margen - 150, ty - 10, ancho - margen, ty - 10)
  ty += 4
  total('Total', quetzales(c.total), true)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TINTA_SUAVE)
  const alto = doc.internal.pageSize.getHeight()
  doc.text('Precios en quetzales. Esta cotización no reserva stock: la disponibilidad se confirma al crear el pedido.', margen, alto - 52, { maxWidth: ancho - margen * 2 })
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 30, { align: 'right' })
  }
  doc.save(nombreArchivo(c))
}
