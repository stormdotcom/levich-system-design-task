export class SimulationService {
  private attemptCounter = new Map<string, number>();
  private readonly failFirstN: number;
  private readonly timeoutProbability: number = 0.03; // 3% chance of timeout
  private readonly minDelay: number = 200; // ms
  private readonly maxDelay: number = 2000; // ms

  constructor() {
    this.failFirstN = parseInt(process.env.FAIL_FIRST_N || '5', 10);
  }

  getFailFirstN(): number {
    return this.failFirstN;
  }

  processAttempt(eventId: string): { shouldReject: boolean; shouldTimeout: boolean; delayMs: number; count: number } {
    const count = (this.attemptCounter.get(eventId) || 0) + 1;
    this.attemptCounter.set(eventId, count);

    const shouldTimeout = Math.random() < this.timeoutProbability;
    const delayMs = shouldTimeout
      ? 15000 // Force timeout > dispatcher 10s
      : Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1) + this.minDelay);

    return {
      shouldReject: count <= this.failFirstN,
      shouldTimeout,
      delayMs,
      count,
    };
  }
}

export const simulationService = new SimulationService();
