import subprocess
HDR='#1F4E79'
def tbl(name,rows,color=HDR):
    r=''.join(f'<tr><td align="left"><font color="{ "#B7791F" if k=="PK" else "#2E6FB0" if k=="FK" else "#5B6B7C"}"><b>{k or "&nbsp;"}</b></font></td><td align="left">{c}</td><td align="left"><font color="#5B6B7C">{t}</font></td></tr>' for k,c,t in rows)
    return f'{name} [label=<<table border="1" cellborder="0" cellspacing="0" cellpadding="4" color="#5B6B7C"><tr><td colspan="3" bgcolor="{color}"><font color="white"><b>{name}</b></font></td></tr>{r}</table>>];'
def graph(nodes,edges,fn,rank='LR'):
    g=f'digraph G {{ rankdir={rank}; nodesep=0.5; ranksep=0.9; splines=true; dpi=170; bgcolor="white"; node [shape=plain fontname="Helvetica" fontsize=11]; edge [fontname="Helvetica" fontsize=10 color="#3A4A5B" arrowhead=crow arrowtail=tee dir=both];\n'+'\n'.join(nodes)+'\n'+'\n'.join(edges)+'\n}'
    open(fn+'.dot','w').write(g)
    subprocess.run(['dot','-Tpng',fn+'.dot','-o',fn+'.png'],check=True)
# Diagrama A: núcleo comercial e inventario
A=[tbl('clientes',[('PK','id','uuid'),('','nombre','text'),('UQ','nit','text'),('','municipio','text')]),
 tbl('pedidos',[('PK','id','uuid'),('UQ','numero','text'),('FK','cliente_id','uuid'),('FK','bodega_id','uuid'),('FK','creado_por','uuid'),('','estado','estado_pedido'),('','total','numeric')]),
 tbl('pedido_lineas',[('PK','id','uuid'),('FK','pedido_id','uuid'),('FK','producto_id','uuid'),('','cantidad','int'),('','precio_unitario','numeric'),('','estado','estado_linea')]),
 tbl('productos',[('PK','id','uuid'),('UQ','sku','text'),('','nombre','text'),('','precio_unitario','numeric'),('','stock_minimo','int')]),
 tbl('stock',[('PK','id','uuid'),('FK','producto_id','uuid'),('FK','bodega_id','uuid'),('','ubicacion','text'),('','disponible','int'),('','reservado','int'),('','en_transito','int'),('','danado','int')],'#14633F'),
 tbl('bodegas',[('PK','id','uuid'),('UQ','nombre','text'),('','latitud / longitud','numeric')]),
 tbl('movimientos_stock',[('PK','id','uuid'),('FK','producto_id','uuid'),('FK','bodega_id','uuid'),('','tipo','tipo_movimiento'),('','cantidad','int'),('','referencia','text'),('FK','usuario_id','uuid')]),
 tbl('usuarios',[('PK','id','uuid'),('','nombre','text'),('','rol','rol_usuario'),('FK','bodega_id','uuid')]),
 tbl('recepciones',[('PK','id','uuid'),('UQ','codigo','text'),('FK','proveedor_id','uuid'),('FK','bodega_id','uuid'),('','estado','estado_recepcion')]),
 tbl('recepcion_lineas',[('PK','id','uuid'),('FK','recepcion_id','uuid'),('FK','producto_id','uuid'),('','cantidad','int')]),
 tbl('proveedores',[('PK','id','uuid'),('','nombre','text'),('UQ','nit','text')])]
EA=['clientes -> pedidos [label=" 1 : N" headlabel="" ];','pedidos -> pedido_lineas;','productos -> pedido_lineas;','productos -> stock;','bodegas -> stock;','bodegas -> pedidos;','productos -> movimientos_stock;','usuarios -> pedidos [label=" crea"];','usuarios -> movimientos_stock;','proveedores -> recepciones;','recepciones -> recepcion_lineas;','productos -> recepcion_lineas;','bodegas -> recepciones;']
graph(A,EA,'er_comercial')
B=[tbl('pedidos',[('PK','id','uuid'),('UQ','numero','text'),('','estado','estado_pedido'),('FK','cliente_id','uuid')]),
 tbl('tareas_picking',[('PK','id','uuid'),('FK','pedido_id (único)','uuid'),('FK','operario_id','uuid'),('','estado','estado_picking')],'#14633F'),
 tbl('picking_lineas',[('PK','id','uuid'),('FK','tarea_id','uuid'),('FK','pedido_linea_id','uuid'),('','cantidad_recogida','int')],'#14633F'),
 tbl('pedido_lineas',[('PK','id','uuid'),('FK','pedido_id','uuid'),('','cantidad','int')]),
 tbl('despachos',[('PK','id','uuid'),('UQ','codigo','text'),('FK','vehiculo_id','uuid'),('FK','conductor_id','uuid'),('FK','bodega_id','uuid'),('','estado','estado_despacho'),('','distancia_km','numeric'),('','duracion_min','int')],'#B7791F'),
 tbl('despacho_paradas',[('PK','id','uuid'),('FK','despacho_id','uuid'),('FK','pedido_id (único)','uuid'),('','orden','int'),('','eta','timestamptz')],'#B7791F'),
 tbl('vehiculos',[('PK','id','uuid'),('','nombre','text'),('UQ','placa','text'),('','capacidad_kg','int')]),
 tbl('conductores',[('PK','id','uuid'),('','nombre','text'),('','telefono','text')]),
 tbl('usuarios',[('PK','id','uuid'),('','nombre','text'),('','rol','rol_usuario')])]
EB=['pedidos -> tareas_picking [label=" 1 : 1" arrowhead=tee];','tareas_picking -> picking_lineas;','pedido_lineas -> picking_lineas [arrowhead=tee];','pedidos -> pedido_lineas;','usuarios -> tareas_picking [label=" asignada"];','despachos -> despacho_paradas;','pedidos -> despacho_paradas [arrowhead=tee label=" 1 : 1"];','vehiculos -> despachos;','conductores -> despachos;']
graph(B,EB,'er_logistica')
