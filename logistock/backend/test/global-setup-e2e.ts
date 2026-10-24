import { alinearSecuenciaParaE2e } from './helpers/pedidos-secuencia';

export default async function globalSetup(): Promise<void> {
  await alinearSecuenciaParaE2e();
}
