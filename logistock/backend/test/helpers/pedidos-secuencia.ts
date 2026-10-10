import { Client } from 'pg';
import { assertEntornoLocal } from './local';

const PATRON_NUMERO_PEDIDO = '^PED-[0-9]{6}$';

async function conPg<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertEntornoLocal();
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function maxNumeroPedido(c: Client): Promise<number> {
  const r = await c.query<{ m: string }>(
    `select coalesce(max(cast(substring(numero from 5) as integer)), 0) as m
     from pedidos where numero ~ $1`,
    [PATRON_NUMERO_PEDIDO],
  );
  return Number(r.rows[0].m);
}

/** Quita paradas y pedidos PED-XXXXXX locales que dejan la secuencia desfasada. */
export async function limpiarPedidosParaE2e(): Promise<void> {
  await conPg(async (c) => {
    await c.query(
      `delete from despacho_paradas
       where pedido_id in (select id from pedidos where numero ~ $1)`,
      [PATRON_NUMERO_PEDIDO],
    );
    await c.query(`delete from pedidos where numero ~ $1`, [PATRON_NUMERO_PEDIDO]);
    await aplicarSetvalSegunMax(c);
  });
}

/** Tras PB-05: el siguiente nextval debe ser max(numero existente)+1. */
export async function sincronizarPedidoNumeroSeqAlMaximo(c: Client): Promise<void> {
  await aplicarSetvalSegunMax(c);
}

async function aplicarSetvalSegunMax(c: Client): Promise<void> {
  const max = await maxNumeroPedido(c);
  if (max === 0) {
    await c.query(`select setval('pedido_numero_seq', 1, false)`);
  } else {
    await c.query(`select setval('pedido_numero_seq', $1, true)`, [max]);
  }
}
