import { format } from 'node:util'

export interface CDPMessageBase {
  id: number
}

export interface CDPMessageEvent {
  method: string
  params: object
}

/**
 * Message from client to server.
 */
export interface CDPMessageIncoming extends CDPMessageBase, CDPMessageEvent {}

export interface CDPMessageResponseSuccess extends CDPMessageBase {
  result: object
}

export interface CDPMessageResponseError extends CDPMessageBase {
  error: {
    message: string
    code?: number
  }
}

export type CDPMessageResponse =
  | CDPMessageResponseSuccess
  | CDPMessageResponseError

/**
 * Message from server to client.
 */
export type CDPMessageOutgoing = CDPMessageEvent | CDPMessageResponse

export class ErrorWithCode extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

export type Domain = Record<string, (...args: unknown[]) => unknown>

export interface DomainImpl {
  getMethods(): string[] | Record<string, (...params: unknown[]) => unknown>
}

export class CDP {
  private idGen = new IdGen()

  private resolves: Map<number, (value?: unknown) => void> = new Map()
  domains: Map<string, Domain> = new Map()

  constructor(private handler: (message: string) => void) {}

  send = ((p1: string | CDPMessageOutgoing, params?: object) => {
    if (typeof p1 === 'object') {
      const message = p1
      if ('id' in message) {
        const resolve = this.resolves.get(message.id)
        if (resolve && 'result' in message) resolve(message.result)
      }

      this.handler(JSON.stringify(message))
    } else {
      this.send({
        method: p1,
        params: params!,
      })
    }
  }) as {
    (method: string, params?: object): void
    (message: CDPMessageOutgoing): void
  }

  receive = (async (p1: string | CDPMessageIncoming, params?: object) => {
    if (typeof p1 === 'object') {
      const { method, params, id } = p1

      const response: CDPMessageResponse = {
        id,
      } as CDPMessageResponse

      try {
        ;(response as CDPMessageResponseSuccess).result =
          (await this.callMethod(method, params)) as object
      } catch (e) {
        if (e instanceof ErrorWithCode) {
          ;(response as CDPMessageResponseError).error = {
            message: e.message,
            code: e.code,
          }
        } else if (e instanceof Error) {
          ;(response as CDPMessageResponseError).error = {
            message: e.message,
          }
        }
      }

      this.send(response)

      return
    } else {
      const method = p1
      const id = this.idGen.id()
      console.log('GENID: %s', id)

      void this.receive({
        id,
        method,
        params: params!,
      })

      return new Promise<unknown>((resolve) => {
        this.resolves.set(id, resolve)
      })
    }
  }) as {
    (method: string, params?: object): Promise<unknown>
    (message: CDPMessageIncoming): Promise<void>
  }

  register = (name: string, impl: DomainImpl) => {
    const domain = this.domains.get(name) || {}

    const methods = impl.getMethods()
    if (Array.isArray(methods))
      for (const method of methods)
        domain[method] = (
          impl as unknown as Record<string, (...params: unknown[]) => unknown>
        )[method]!.bind(impl)
    else
      for (const method in methods) domain[method] = methods[method]!.bind(impl)
    this.domains.set(name, domain)
  }

  private callMethod = async (
    method: string,
    params: unknown,
  ): Promise<unknown> => {
    const [domainName, methodName] = method.split('.') as [string, string]
    const domain = this.domains.get(domainName)
    if (domain && domain[methodName]) return domain[methodName]!(params) || {}

    // FIXME
    if (process.env['NODINS_DEBUG'])
      console.error('[Nodins] FIXME: %s %o', method, params)
    throw new Error(format('FIXME: %s %o', method, params))
  }
}

class IdGen {
  private current = 0

  id = () => {
    this.current--
    return this.current
  }
}
