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

    // If failFirstN is set, enforce failure for first N attempts
    // This allows deterministic log proofs as required by the assignment
    let shouldReject = false;
    let shouldTimeout = false;
    let delayMs = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1) + this.minDelay);

    if (count <= this.failFirstN) {
      // Deterministic failure phase
      shouldReject = true;
      // Occasionally simulate timeout even in deterministic phase for variety
      if (Math.random() < 0.2) {
        shouldTimeout = true;
        delayMs = 12000;
      }
    } else {
      // Probabilistic chaos phase (realistic server behavior)
      const roll = Math.random();
      if (roll < 0.4) {
        // Immediate failure
        shouldReject = true;
      } else if (roll < 0.7) {
        // Delayed failure (simulates timeout)
        shouldReject = true;
        shouldTimeout = true;
        delayMs = 12000;
      }
      // Else: Success
    }

    return {
      shouldReject,
      shouldTimeout,
      delayMs,
      count,
    };
  }
}

export const simulationService = new SimulationService();
