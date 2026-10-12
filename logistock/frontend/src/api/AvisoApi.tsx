import { ApiError, textoDe } from './cliente'

export function AvisoApi({ error }: { error: ApiError }) {
  return <p role="alert">{textoDe(error)}</p>
}
