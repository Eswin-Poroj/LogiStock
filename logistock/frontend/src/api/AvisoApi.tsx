import { ApiError, textoDe } from './cliente'

export function AvisoApi({ error }: { error: ApiError }) {
  return <p role="alert" className="aviso-api aviso-api--error">{textoDe(error)}</p>
}
