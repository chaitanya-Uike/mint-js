import { ScopeNode } from "../core";

export class StoreNode extends ScopeNode {
  private cache: SignalCache;
  constructor() {
    super();
  }

  updateScope(newScope: ScopeNode | null): void {
    if (this.scope === newScope) return;
    for (const [, entry] of this.cache) entry.updateScope(newScope);
    super.updateScope(newScope);
  }

  dispose(): void {
    this.cache.clear();
    super.dispose();
  }
}
