import type { CDP, DomainImpl } from '../cdp'

export class Debugger implements DomainImpl {
  constructor(_cdp: CDP) {}

  isRunning = () => false
  isConnected = () => false
  isReady = () => false
  enable = (_p: { maxScriptsCacheSize: number }) => {}
  connect = () => {}
  request = () => {}
  close = () => {}
  clearBreakpoint = () => {}
  evaluateGlobal = () => {}
  setPauseOnExceptions = (_p: { state: 'none' }) => {}
  setAsyncCallStackDepth = (_p: { maxDepth: 32 }) => {}
  setBlackboxPatterns = (_p: { patterns: unknown[] }) => {}
  setBreakpointByUrl = ({
    urlRegex,
  }: {
    lineNumber: number
    url: string
    columnNumber: number
    condition: string
    urlRegex: string
  }) => {
    if (urlRegex)
      throw new Error('Nodins do not support setBreakpointByUrl with urlRegex')
  }

  getMethods = () => [
    // 'isRunning',
    // 'isConnected',
    // 'isReady',
    'enable',
    // 'connect',
    // 'request',
    // 'close',
    // 'clearBreakpoint',
    // 'evaluateGlobal',
    'setPauseOnExceptions',
    'setAsyncCallStackDepth',
    'setBlackboxPatterns',
    'setBreakpointByUrl',
  ]
}
