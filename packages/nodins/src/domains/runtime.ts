import { isMap, isNativeError, isRegExp, isSet } from 'node:util/types'
import type { CDP, DomainImpl } from '../cdp'

const consoleMethods = {
  log: 'log',
  warn: 'warning',
  error: 'error',
  info: 'info',
  dir: 'dir',
  table: 'table',
  group: 'startGroup',
  groupCollapsed: 'startGroupCollapsed',
  groupEnd: 'endGroup',
  debug: 'debug',
  clear: 'clear',
} as const

type ConsoleMethods = typeof consoleMethods

const context = {
  id: 1,
  isPageContext: true,
  name: 'Nodins Debug Console',
}

export class Runtime implements DomainImpl {
  constructor(private cdp: CDP) {}

  enable = (_p: Record<string, never>) => {
    this.wrapConsole()

    this.cdp.send('Runtime.executionContextCreated', {
      context,
    })

    console.info(
      `%cNodins v${process.env['__DEFINE_NODINS_VERSION__']}`,
      'background:#111;color:white;padding:8px 24px;',
    )
  }

  runIfWaitingForDebugger = (_p: Record<string, never>) => {}

  evaluate = ({
    expression,
  }: {
    expression: string
    contextId: number
    throwOnSideEffect: boolean
  }) => {
    let evalResult: unknown
    try {
      try {
        evalResult = eval.call(global, `(${expression})`)
      } catch (e) {
        evalResult = eval.call(global, expression)
      }

      ;(
        global as unknown as {
          $_: unknown
        }
      ).$_ = evalResult

      return {
        result: wrap(evalResult),
      }
    } catch (e) {
      return {
        exceptionDetails: {
          exception: wrap(e),
          text: 'Uncaught',
        },
        result: wrap(e),
      }
    }
  }

  compileScript = (_p: {
    expression: string
    sourceURL: string
    persistScript: boolean
    executionContextId: number
  }) => {}

  globalLexicalScopeNames = (_p: { executionContextId: number }) =>
    Object.getOwnPropertyNames(global)

  private wrapConsole = () => {
    ;(
      Object.entries(consoleMethods) as [
        keyof ConsoleMethods,
        ConsoleMethods[keyof ConsoleMethods],
      ][]
    ).forEach(([name, type]) => {
      if (!console[name]) return
      const origin = console[name].bind(console)
      console[name] = (...args: unknown[]) => {
        origin(...args)

        this.cdp.send('Runtime.consoleAPICalled', {
          type,
          args: args.map(wrap),
          stackTrace: {
            callFrames:
              type === 'error' || type === 'warning' ? getCallFrames() : [],
          },
          executionContextId: context.id,
          timestamp: new Date().getTime(),
        })
      }
    })
  }

  getMethods = () => [
    'enable',
    'runIfWaitingForDebugger',
    'evaluate',
    'compileScript',
    'globalLexicalScopeNames',
  ]
}

function getCallFrames() {
  const origin = Error.prepareStackTrace
  Error.prepareStackTrace = (_, stack) => stack
  const stack = new Error().stack?.slice(1) as unknown as NodeJS.CallSite[]
  Error.prepareStackTrace = origin
  return stack.map((callSite) => {
    return {
      functionName: callSite.getFunctionName(),
      lineNumber: callSite.getLineNumber(),
      columnNumber: callSite.getColumnNumber(),
      url: callSite.getFileName(),
    }
  })
}

function wrap(arg: unknown) {
  const result = {
    value: arg,
    type: typeof arg,
    subtype: 'object',
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    description: (arg as object).toString(),
    className: undefined as unknown as string | undefined,
  }

  if (arg === null) result.subtype = 'null'
  if (Array.isArray(arg)) {
    result.subtype = 'array'
    result.className = 'Array'
  }
  if (isRegExp(arg)) {
    result.subtype = 'regexp'
    result.className = 'RegExp'
  }
  if (isNativeError(arg)) {
    result.subtype = 'error'
    result.className = arg.name
  }
  if (isMap(arg)) {
    result.subtype = 'map'
    result.className = 'Map'
  }
  if (isSet(arg)) result.subtype = 'set'

  if (
    result.type === 'undefined' ||
    result.type === 'string' ||
    result.type === 'boolean' ||
    result.type === 'number' ||
    result.type === 'bigint' ||
    result.type === 'symbol' ||
    result.subtype === 'null'
  ) {
    return result
  }

  if (result.type === 'function') {
    result.className = 'Function'
  }

  result.className ??= /^\[object\s+(.*?)]$/.exec(arg as string)?.[1]

  return result
}
