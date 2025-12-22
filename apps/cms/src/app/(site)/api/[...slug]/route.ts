import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
} from '@payloadcms/next/routes'

const getHandler = REST_GET(config)
const postHandler = REST_POST(config)
const deleteHandler = REST_DELETE(config)
const patchHandler = REST_PATCH(config)
const optionsHandler = REST_OPTIONS(config)

type RouteContext = { params: Promise<{ slug: string[] }> }

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params
  return getHandler(request, { params })
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params
  return postHandler(request, { params })
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = await context.params
  return deleteHandler(request, { params })
}

export async function PATCH(request: Request, context: RouteContext) {
  const params = await context.params
  return patchHandler(request, { params })
}

export async function OPTIONS(request: Request, context: RouteContext) {
  void context
  return optionsHandler(request)
}
