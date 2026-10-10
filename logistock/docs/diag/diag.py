import subprocess
N='#1F4E79';G='#14633F';A='#B7791F';R='#8F2A17';T='#3A4A5B'
HEAD='''digraph G { %s dpi=160; bgcolor="white"; fontname="Helvetica"; 
 node [fontname="Helvetica" fontsize=11 shape=box style="rounded,filled" fillcolor="#EAF1F8" color="#1F4E79" penwidth=1.2 margin="0.14,0.08"];
 edge [fontname="Helvetica" fontsize=10 color="#3A4A5B" arrowsize=0.8];
'''
def mk(name,body,opts='rankdir=LR; nodesep=0.5; ranksep=0.7;'):
    open(name+'.dot','w').write(HEAD%opts+body+'\n}')
    subprocess.run(['dot','-Tpng',name+'.dot','-o',name+'.png'],check=True)

# 1 Estados del pedido
mk('estados_pedido','''
 ini [shape=circle label="" width=0.22 style=filled fillcolor="#14202E" color="#14202E"];
 c [label="Creado\\nstock reservado" fillcolor="#EAF1F8"];
 p [label="En preparación\\npicking en curso" fillcolor="#DCE8F5"];
 d [label="Despachado\\nasignado a una ruta" fillcolor="#FCEFD9" color="#B7791F"];
 e [label="Entregado" fillcolor="#E3F3EA" color="#14633F"];
 x [label="Cancelado\\nstock liberado" fillcolor="#FBE4DE" color="#8F2A17"];
 fin [shape=doublecircle label="" width=0.2 style=filled fillcolor="#14202E" color="#14202E"];
 ini -> c [label="  crear pedido\\n  (CU-01)"];
 c -> p [label="primer escaneo\\nde picking"];
 p -> d [label="asignar despacho\\n(CU-06)"];
 d -> e [label="confirmar entrega\\n(CU-07)"];
 e -> fin;
 c -> x [label="cancelar (CU-08)" color="#8F2A17" fontcolor="#8F2A17"];
 p -> x [label="cancelar (CU-08)" color="#8F2A17" fontcolor="#8F2A17"];
 x -> fin;
''','rankdir=LR; nodesep=0.55; ranksep=0.75;')

# 2 Estados de las unidades de stock
mk('estados_stock','''
 prov [label="Proveedor\\n(externo)" shape=box style="rounded,dashed" fillcolor="white"];
 tr [label="En tránsito" fillcolor="#FCEFD9" color="#B7791F"];
 di [label="Disponible" fillcolor="#E3F3EA" color="#14633F"];
 re [label="Reservado" fillcolor="#DCE8F5"];
 da [label="Dañado" fillcolor="#FBE4DE" color="#8F2A17"];
 sa [label="Salida\\n(entregado al cliente)" shape=box style="rounded,dashed" fillcolor="white"];
 prov -> di [label="entrada de mercancía\\nregistrar_entrada() · CU-03"];
 prov -> tr [label="orden en camino" style=dashed];
 tr -> di [label="llega a la bodega"];
 di -> re [label="reservar_stock()\\npedido creado · CU-01/02"];
 re -> di [label="liberar_stock()\\ncancelación · CU-08" color="#8F2A17" fontcolor="#8F2A17"];
 re -> sa [label="despacho confirmado\\nCU-06"];
 di -> da [label="ajuste por daño\\nCU-04" color="#8F2A17" fontcolor="#8F2A17"];
''','rankdir=LR; nodesep=0.7; ranksep=1.0;')

# 3 Navegación
mk('navegacion','''
 login [label="Iniciar sesión\\n(Login)" fillcolor="#14344F" fontcolor=white];
 hub [label="Menú lateral\\n(Pedidos · Inventario · Picking\\nDespacho · Reportes)" shape=box fillcolor="white" style="rounded,bold"];
 login -> hub [label=" según rol"];
 subgraph cluster_p { label="Pedidos (asesor de ventas)"; fontsize=11; color="#AAB7C4"; style=rounded;
   np [label="Nuevo pedido de venta\\n(CU-01)"]; lin [label="Resolver línea sin stock\\najustar · sustituto · backorder" fillcolor="#FBE4DE" color="#8F2A17"]; dp [label="Detalle del pedido\\ncancelar (CU-08)"];
   np -> lin [label="stock insuficiente"]; lin -> np; np -> dp [label="confirmar"]; }
 subgraph cluster_i { label="Inventario (bodega)"; fontsize=11; color="#AAB7C4"; style=rounded;
   inv [label="Inventario por bodega\\n(CU-09)"]; ds [label="Detalle de SKU\\nmovimientos"]; aj [label="Registrar ajuste o daño\\n(CU-04)"]; en [label="Registrar entrada\\n(CU-03)"];
   inv -> ds; ds -> aj; inv -> en; }
 subgraph cluster_k { label="Picking (operario)"; fontsize=11; color="#AAB7C4"; style=rounded;
   pk [label="Tablero de picking"]; tk [label="Tarea de picking\\nescanear SKU (CU-05)"]; fa [label="Reportar faltante" fillcolor="#FCEFD9" color="#B7791F"];
   pk -> tk; tk -> fa; }
 subgraph cluster_d { label="Despacho (jefe de logística / chofer)"; fontsize=11; color="#AAB7C4"; style=rounded;
   ds1 [label="Planificar despacho\\nelegir pedidos"]; ru [label="Ruta propuesta\\n(CU-06)"]; se [label="Seguimiento y entrega\\n(CU-07)"];
   ds1 -> ru [label="calcular"]; ru -> ds1 [label="recalcular"]; ru -> se [label="asignar"]; }
 subgraph cluster_r { label="Reportes (administrador)"; fontsize=11; color="#AAB7C4"; style=rounded;
   rp [label="Reportes e indicadores\\n(CU-10)"]; ex [label="Exportar a Excel"]; rp -> ex; }
 hub -> np; hub -> inv; hub -> pk; hub -> ds1; hub -> rp;
''','rankdir=LR; nodesep=0.35; ranksep=0.8; compound=true;')

# 4/5 Actividades: flujo único, color por actor
def nd(id,txt,actor): 
    c={'S':('#EAF1F8','#1F4E79'),'O':('#E3F3EA','#14633F'),'J':('#FCEFD9','#B7791F'),'C':('#EEE6F7','#6B3FA0')}[actor]
    return f'{id} [label=<{txt}> fillcolor="{c[0]}" color="{c[1]}"];\n'
def dm(id,txt): return f'{id} [shape=diamond label=<{txt}> style=filled fillcolor="#FFFFFF" color="#14202E" margin="0,0" width=2.6 height=1.2];\n'
INI='ini [shape=circle label="" width=0.2 style=filled fillcolor="#14202E" color="#14202E"];\nfin [shape=doublecircle label="" width=0.18 style=filled fillcolor="#14202E" color="#14202E"];\n'
def legend(items):
    cols={'S':('#EAF1F8','#1F4E79','Sistema'),'O':('#E3F3EA','#14633F','Operario de bodega'),'J':('#FCEFD9','#B7791F','Jefe de logística'),'C':('#EEE6F7','#6B3FA0','Chofer / repartidor')}
    rows=''.join(f'<td bgcolor="{cols[k][0]}" border="1" color="{cols[k][1]}"> {cols[k][2]} </td>' for k in items)
    return f'leg [shape=plain style="" label=<<table border="0" cellspacing="6"><tr>{rows}</tr></table>>];\n'
b=INI+legend('SO')
b+=nd('s1','<b>Sistema</b><br/>Pedido confirmado: encola el trabajo en BullMQ','S')
b+=nd('s2','<b>Sistema</b><br/>Worker crea la tarea de picking<br/>y una línea por producto reservado','S')
b+=nd('o1','<b>Operario</b><br/>Abre el tablero y toma la tarea','O')
b+=nd('o2','<b>Operario</b><br/>Va a la ubicación y escanea el SKU','O')
b+=nd('s3','<b>Sistema</b><br/>Valida el SKU contra las líneas de la tarea','S')
b+=dm('d1','¿SKU de la tarea<br/>y falta cantidad?')
b+=nd('s4','<b>Sistema</b><br/>Rechaza el escaneo con mensaje','S')
b+=nd('s5','<b>Sistema</b><br/>Suma lo recogido · tarea En curso<br/>pedido En preparación','S')
b+=dm('d2','¿Todas las<br/>líneas completas?')
b+=nd('o3','<b>Operario</b><br/>Marca la tarea como lista','O')
b+=nd('s6','<b>Sistema</b><br/>Tarea completada:<br/>pedido listo para despacho','S')
b+=nd('o4','<b>Operario</b><br/>Reporta faltante (producto no está)','O')
b+=nd('s7','<b>Sistema</b><br/>Tarea con faltante:<br/>avisa al asesor de ventas','S')
b+='ini->s1->s2->o1->o2->s3->d1;\nd1->s4[label="no"];s4->o2;\nd1->s5[label="sí"];s5->d2;\nd2->o2[label="no: siguiente línea"];\nd2->o3[label="sí"];o3->s6->fin;\no2->o4[style=dashed label="faltante"];o4->s7->fin;\nleg->ini[style=invis];\n'
mk('act_picking',b,'rankdir=TB; nodesep=0.5; ranksep=0.4;')

b=INI+legend('JS')
b+=nd('j1','<b>Jefe de logística</b><br/>Selecciona pedidos listos,<br/>vehículo y conductor','J')
b+=nd('s1','<b>Sistema</b><br/>Calcula la ruta con OSRM<br/>(orden de paradas y tiempos)','S')
b+=dm('d1','¿Respondió<br/>el motor?')
b+=nd('s2','<b>Sistema</b><br/>Respaldo: Google Directions<br/>o caché de rutas (R2)','S')
b+=nd('j3','<b>Jefe de logística</b><br/>Revisa la ruta propuesta','J')
b+=dm('d2','¿Acepta<br/>la ruta?')
b+=nd('j4','<b>Jefe de logística</b><br/>Asigna el despacho','J')
b+=nd('s3','<b>Sistema</b><br/>Crea despacho y paradas;<br/>pedidos pasan a Despachado','S')
b+='ini->j1->s1->d1;\nd1->j3[label="sí"];d1->s2[label="no"];s2->j3;\n{rank=same; d1; s2}\nj3->d2;d2->j4[label="sí"];d2->j1[label="no: cambiar y recalcular" constraint=false];\nj4->s3->fin;\nleg->ini[style=invis];\n'
mk('act_despacho',b,'rankdir=TB; nodesep=0.45; ranksep=0.3;')

b=INI+legend('CS')
b+=nd('c1','<b>Chofer</b><br/>Consulta su ruta<br/>e inicia el recorrido','C')
b+=nd('c2','<b>Chofer</b><br/>Entrega en la parada<br/>y confirma en la app','C')
b+=nd('s4','<b>Sistema</b><br/>Pedido pasa a Entregado;<br/>registra la hora real','S')
b+=dm('d3','¿Quedan<br/>paradas?')
b+=nd('s5','<b>Sistema</b><br/>Despacho Finalizado','S')
b+='ini->c1->c2->s4->d3;d3->c2[label="sí" constraint=false];d3->s5[label="no"];s5->fin;\nleg->ini[style=invis];\n'
mk('act_entrega',b,'rankdir=TB; nodesep=0.5; ranksep=0.3;')

# 6 Despliegue
mk('despliegue','''
 subgraph cluster_u { label="Dispositivo del usuario"; labeljust=l; color="#AAB7C4"; style=rounded; fontsize=12;
  web [label="Aplicación web responsiva\\n(navegador PC / teléfono)" shape=box3d fillcolor="#EAF1F8"]; }
 subgraph cluster_a { label="Servidor propio (contenedores Docker)"; labeljust=l; color="#AAB7C4"; style=rounded; fontsize=12;
  api [label="API REST · NestJS (Node 20)\\n/api/v1 · Swagger /docs" shape=box3d fillcolor="#DCE8F5"];
  wk [label="Worker de picking\\nBullMQ (proceso independiente)" shape=box3d fillcolor="#DCE8F5"];
  rd [label="Redis 7\\nlocks (Redlock) y colas" shape=cylinder fillcolor="#FCEFD9" color="#B7791F"];
  os [label="OSRM\\nmotor de rutas" shape=box3d fillcolor="#E3F3EA" color="#14633F"]; }
 subgraph cluster_s { label="Supabase (nube)"; labeljust=l; color="#AAB7C4"; style=rounded; fontsize=12;
  pg [label="PostgreSQL 16\\ntablas · RLS · funciones SQL" shape=cylinder fillcolor="#E3F3EA" color="#14633F"];
  au [label="Supabase Auth\\n(JWT)" shape=box3d fillcolor="#EAF1F8"];
  rt [label="Supabase Realtime\\n(notificaciones)" shape=box3d fillcolor="#EAF1F8"]; }
 subgraph cluster_e { label="Servicio externo"; labeljust=l; color="#AAB7C4"; style=rounded; fontsize=12;
  gd [label="Google Directions API\\n(respaldo de rutas)" shape=box3d style="filled,dashed" fillcolor="white"]; }
 web -> api [label="HTTPS · JSON\\nBearer JWT"];
 web -> au [label="HTTPS\\ninicio de sesión"];
 web -> rt [label="WebSocket\\neventos" style=dashed];
 api -> pg [label="HTTPS (supabase-js)\\nservice_role · RPC"];
 api -> au [label="valida JWT"];
 api -> rd [label="TCP 6379\\nlocks y encolado"];
 wk -> rd [label="consume cola"];
 wk -> pg [label="HTTPS"];
 api -> os [label="HTTP\\nroute / trip"];
 api -> gd [label="HTTPS\\nrespaldo" style=dashed];
 pg -> rt [style=dashed arrowhead=none];
''','rankdir=LR; nodesep=0.5; ranksep=1.1; newrank=true;')
