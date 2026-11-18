import { APIError } from 'payload'

export function fehler(status: number, nachricht: string): APIError {
  return new APIError(nachricht, status, undefined, true) as unknown as APIError
}
