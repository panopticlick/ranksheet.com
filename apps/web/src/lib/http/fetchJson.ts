export class HttpError extends Error {
  readonly status: number
  readonly url: string
  readonly bodyText: string

  constructor(args: { status: number; url: string; bodyText: string }) {
    super(`HTTP ${args.status} for ${args.url}`)
    this.status = args.status
    this.url = args.url
    this.bodyText = args.bodyText
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15_000, ...rest } = init

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(rest.headers ?? {}),
      },
    })

    const text = await res.text()
    if (!res.ok) {
      throw new HttpError({ status: res.status, url, bodyText: text.slice(0, 2000) })
    }

    return JSON.parse(text) as T
  } finally {
    clearTimeout(timeout)
  }
}

