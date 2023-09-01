import type { CDP, DomainImpl } from '../cdp'

export class Profiler implements DomainImpl {
  constructor(_cdp: CDP) {}

  enable = (_p: Record<string, never>) => {}

  getMethods = () => ['enable']
}
