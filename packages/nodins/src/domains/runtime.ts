import type { CDP, DomainImpl } from '../cdp'

export class Runtime implements DomainImpl {
  constructor(private cdp: CDP) {}

  enable = (_p: Record<string, never>) => {
    this.cdp.send('Runtime.executionContextCreated', {
      context: {
        id: 1,
        isPageContext: true,
        name: '',
      },
    })
  }

  runIfWaitingForDebugger = (_p: Record<string, never>) => {}

  getMethods = () => ['enable', 'runIfWaitingForDebugger']
}
