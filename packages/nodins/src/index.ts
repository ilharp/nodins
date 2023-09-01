import { Server } from 'node:http'
import { WebSocketServer } from 'ws'
import type { CDPMessageIncoming } from './cdp'
import { CDP } from './cdp'
import { Debugger } from './domains/debugger'
import { Profiler } from './domains/profiler'
import { Runtime } from './domains/runtime'

export * from './cdp'

export interface NodinsConfig {
  host: string
  port: number
}

export interface NodinsVanillaConfig extends NodinsConfig {
  buildCDP: (cdp: CDP) => void
}

export const defaultCDPConfig: Partial<NodinsVanillaConfig> = {
  host: '127.0.0.1',
  port: 9229,
  buildCDP: () => {},
} as const

export const nodinsVanilla = async (config?: Partial<NodinsVanillaConfig>) => {
  const parsedConfig = Object.assign(
    {},
    defaultCDPConfig,
    config,
  ) as NodinsVanillaConfig

  const { host, port } = parsedConfig
  delete (parsedConfig as Partial<NodinsVanillaConfig>).port

  const version = process.env['__DEFINE_NODINS_VERSION__']

  const server = new Server((req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`)

    switch (url.pathname) {
      case '/': {
        const result = `Nodins v${version}`
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': '',
          'Content-Length': Buffer.byteLength(result),
        })
        res.end(result)
        return
      }

      case '/json/version':
      case '/json/version/': {
        const result = JSON.stringify({
          Browser: `Nodins/v${version}`,
          'Protocol-Version': '1.1',
          'V8-Version': process.versions.v8,
          webSocketDebuggerUrl: `ws://${host}:${port}/`,
        })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': '',
          'Content-Length': Buffer.byteLength(result),
        })
        res.end(result)
        return
      }

      case '/json':
      case '/json/':
      case '/json/list':
      case '/json/list/': {
        const result = JSON.stringify([
          {
            description: 'Nodins Instance',
            devtoolsFrontendUrl: `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=${host}:${port}`,
            devtoolsFrontendUrlCompat: `devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=${host}:${port}`,
            faviconUrl: 'https://nodejs.org/static/images/favicons/favicon.ico',
            id: 'nodins',
            title: `Nodins[${process.pid}]`,
            type: 'node',
            url: 'file://',
            webSocketDebuggerUrl: `ws://${host}:${port}/`,
          },
        ])
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': '',
          'Content-Length': Buffer.byteLength(result),
        })
        res.end(result)
        return
      }

      case '/json/protocol':
      case '/json/protocol/': {
        const result = JSON.stringify({
          version: {
            major: '1',
            minor: '0',
          },
          domains: [],
        })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': '',
          'Content-Length': Buffer.byteLength(result),
        })
        res.end(result)
        return
      }

      default: {
        const result = '400 bad request'
        res.writeHead(400, {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Transfer-Encoding': '',
          'Content-Length': Buffer.byteLength(result),
        })
        res.end(result)
        return
      }
    }
  })

  const wss = new WebSocketServer({
    ...parsedConfig,
    server,
  })

  wss.on('error', console.error)

  wss.on('connection', (ws) => {
    ws.on('error', console.error)

    const cdp = new CDP((message) => {
      if (
        process.env['NODINS_DEBUG'] &&
        !message.includes('"result":{}') &&
        !message.includes('"message":"FIXME:') &&
        !message.startsWith('{"method":"Runtime.consoleAPICalled')
      )
        process.stderr.write(`[Nodins] SEND: ${message}\n`)
      ws.send(message)
    })
    parsedConfig.buildCDP(cdp)

    ws.on(
      'message',
      (data) =>
        void cdp.receive(
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          JSON.parse(data.toString('utf-8')) as CDPMessageIncoming,
        ),
    )
  })

  return () => server.listen(port, host)
}

export const nodins = (config?: Partial<NodinsConfig>) =>
  nodinsVanilla({
    ...config,
    buildCDP: (cdp) => {
      cdp.register('Runtime', new Runtime(cdp))
      cdp.register('Debugger', new Debugger(cdp))
      cdp.register('Profiler', new Profiler(cdp))
    },
  })

if (process.env['NODINS_INSPECT']) void nodins().then((f) => f())
