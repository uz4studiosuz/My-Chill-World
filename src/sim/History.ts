export interface Sample {
  /** Game time in seconds. */
  t: number;
  day: number;
  pop: number;
  employed: number;
  money: number;
  stone: number;
  food: number;
  wood: number;
  /** Percent of energy demand supplied. */
  energy: number;
  cars: number;
  trucks: number;
  walkers: number;
  animals: number;
  happy?: number;
  iron?: number;
}

const INTERVAL = 6;
const MAX_SAMPLES = 240;

/** Time series for the statistics charts. */
export class History {
  samples: Sample[] = [];
  private acc = INTERVAL;

  update(dt: number, take: () => Sample) {
    this.acc += dt;
    if (this.acc < INTERVAL) return;
    this.acc = 0;
    this.samples.push(take());
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }
}
