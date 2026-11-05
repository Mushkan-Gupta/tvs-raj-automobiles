// =============================================================================
// _shared/timing.ts
// Performance measurement & Server-Timing header utility for Edge Functions
// =============================================================================

export class ServerTimer {
  private startTime = performance.now();
  private measurements: Record<string, number> = {};
  private activeTimers: Record<string, number> = {};

  start(name: string): void {
    this.activeTimers[name] = performance.now();
  }

  end(name: string): void {
    const start = this.activeTimers[name];
    if (start !== undefined) {
      const dur = performance.now() - start;
      this.measurements[name] = (this.measurements[name] || 0) + dur;
      delete this.activeTimers[name];
    }
  }

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      const dur = performance.now() - t0;
      this.measurements[name] = (this.measurements[name] || 0) + dur;
    }
  }

  getHeader(): string {
    const total = performance.now() - this.startTime;
    const parts = Object.entries(this.measurements).map(
      ([key, dur]) => `${key};dur=${dur.toFixed(1)}`
    );
    parts.push(`total;dur=${total.toFixed(1)}`);
    return parts.join(", ");
  }

  log(fnName: string): void {
    const total = performance.now() - this.startTime;
    const payload: Record<string, unknown> = {
      fn: fnName,
      total_ms: Math.round(total),
    };
    for (const [k, v] of Object.entries(this.measurements)) {
      payload[`${k}_ms`] = Math.round(v);
    }
    console.log(JSON.stringify(payload));
  }
}

