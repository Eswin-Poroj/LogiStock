import { limpiarPedidosParaE2e } from './helpers/pedidos-secuencia';

export default async function globalSetup(): Promise<void> {
  await limpiarPedidosParaE2e();
}
