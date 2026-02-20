export class SimulationService {
  private attemptCounter = new Map<string, number>();
  private readonly failFirstN: number;

  constructor() {
    this.failFirstN = parseInt(process.env.FAIL_FIRST_N || '5', 10);
  }

  getFailFirstN(): number {
    return this.failFirstN;
  }


  processAttempt(eventId: string): { shouldReject: boolean; count: number } {
    const count = (this.attemptCounter.get(eventId) || 0) + 1;
    this.attemptCounter.set(eventId, count);

    return {
      shouldReject: count <= this.failFirstN,
      count,
    };
  }
}

export const simulationService = new SimulationService();
