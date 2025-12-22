import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

declare global {
  var __rsPayload: Payload | undefined
}

export async function getPayloadClient(): Promise<Payload> {
  if (globalThis.__rsPayload) return globalThis.__rsPayload
  const config = await configPromise
  globalThis.__rsPayload = await getPayload({ config })
  return globalThis.__rsPayload
}
