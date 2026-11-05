/**
 * Volatile epoch for authenticated work in the field client.
 *
 * A new epoch invalidates every pending Promise continuation from the old
 * identity, organization or logout attempt. Epochs are Symbols and are never
 * persisted, transmitted or derived from personal data.
 *
 * This is a client-side defense in depth; backend authorization remains
 * mandatory for every query and mutation.
 */
export class SessionEpoch {
  private epoch: symbol = Symbol("field-session");
  private authorized = false;

  snapshot(): symbol {
    return this.epoch;
  }

  isCurrent(ticket: symbol): boolean {
    return ticket === this.epoch;
  }

  isOperational(ticket: symbol): boolean {
    return this.isCurrent(ticket) && this.authorized;
  }

  beginAuthentication(): symbol {
    this.authorized = false;
    this.epoch = Symbol("field-authentication");
    return this.epoch;
  }

  grant(ticket: symbol): boolean {
    if (!this.isCurrent(ticket)) return false;
    this.authorized = true;
    return true;
  }

  changeScope(): symbol {
    this.epoch = Symbol("field-scope");
    return this.epoch;
  }

  revoke(): void {
    this.authorized = false;
    this.epoch = Symbol("field-revoked");
  }
}
