import { describe, expect, it } from "vitest";
import { formatarDataHora, somarDias, somarMeses } from "./date";

describe("somarMeses", () => {
  it("mantem o dia quando ele existe no mes de destino", () => {
    expect(somarMeses("2026-10-15", 3)).toBe("2027-01-15");
    expect(somarMeses("2026-10-15", -10)).toBe("2025-12-15");
  });

  it("cai no ultimo dia do mes quando o dia nao existe", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-11-30", 3)).toBe("2027-02-28");
    expect(somarMeses("2026-10-31", -1)).toBe("2026-09-30");
  });
});

describe("outras datas", () => {
  it("somarDias atravessa meses e anos", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("formatarDataHora mostra data e hora sem segundos", () => {
    expect(formatarDataHora("2026-10-29T15:01:56")).toBe("29/10/2026 · 15:01");
    expect(formatarDataHora("2026-10-29")).toBe("29/10/2026");
  });
});
