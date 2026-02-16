type LogMetadata = unknown

type ErrorPayload = {
  context: string
  error: string
  metadata?: LogMetadata
  timestamp: string
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function resolveLogEndpoint(): string | null {
  if (typeof window !== 'undefined') {
    return '/api/log-error'
  }

  const configuredBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')

  if (!configuredBase) {
    return null
  }

  return `${configuredBase.replace(/\/$/, '')}/api/log-error`
}

function sendToLoggingService(payload: ErrorPayload): void {
  const endpoint = resolveLogEndpoint()
  if (!endpoint) {
    return
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).catch(() => {
    // Intentionally silent to avoid throwing while handling errors.
  })
}

export const logger = {
  error: (context: string, error: unknown, metadata?: LogMetadata) => {
    console.error(`[${context}]`, error, metadata)

    if (process.env.NODE_ENV === 'production') {
      sendToLoggingService({
        context,
        error: toErrorMessage(error),
        metadata,
        timestamp: new Date().toISOString()
      })
    }
  },

  info: (context: string, message: string, metadata?: LogMetadata) => {
    console.log(`[${context}]`, message, metadata)
  },

  warn: (context: string, message: string, metadata?: LogMetadata) => {
    console.warn(`[${context}]`, message, metadata)
  }
}

