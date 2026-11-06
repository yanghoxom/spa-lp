/** Node-only class bases. Live Worker behavior is checked with workerd separately. */
export class WorkerEntrypoint<E = unknown, P = unknown> {
  constructor(protected ctx: ExecutionContext<P>, protected env: E) {}
}

export class DurableObject<E = unknown> {
  constructor(protected ctx: DurableObjectState, protected env: E) {}
}
