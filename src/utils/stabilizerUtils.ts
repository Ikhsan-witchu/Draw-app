// ─── Stroke Stabilizer (Penghalus Goresan ibisPaint / CSP style) ──────────────

export interface PointWithPressure {
  x: number;
  y: number;
  pressure: number;
}

export class StrokeStabilizer {
  private current: PointWithPressure | null = null;

  /**
   * Reset posisi stabilizer ke titik awal goresan
   */
  public reset(startPoint: PointWithPressure): PointWithPressure {
    this.current = { ...startPoint };
    return { ...startPoint };
  }

  /**
   * Hitung titik berikutnya dengan filter penghalusan berbasis strength (0 - 10).
   * Strength 0 = langsung tanpa delay/smoothing.
   * Strength 1-10 = interpolasi halus dengan bobot peredam getaran tangan.
   */
  public filter(target: PointWithPressure, strength: number): PointWithPressure {
    if (!this.current || strength <= 0) {
      this.current = { ...target };
      return { ...target };
    }

    // Hitung faktor smoothing: semakin tinggi strength, pergerakan semakin stabil
    const factor = 1 / (1 + strength * 0.8);

    this.current.x += (target.x - this.current.x) * factor;
    this.current.y += (target.y - this.current.y) * factor;
    this.current.pressure += (target.pressure - this.current.pressure) * factor;

    return { ...this.current };
  }

  /**
   * Mengembalikan titik posisi saat ini
   */
  public getCurrent(): PointWithPressure | null {
    return this.current ? { ...this.current } : null;
  }
}
