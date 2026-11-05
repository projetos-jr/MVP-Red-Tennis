/**
 * Bola de entrar do login: é o botão de enviar do formulário (Enter também
 * entra), tem nome para o leitor de tela começando com "Entrar" (a palavra
 * que aparece embaixo da bola) e, enquanto entra, fica travada com "Entrando…".
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotaoBola } from "./BotaoBola";

function desenhar(props: Parameters<typeof BotaoBola>[0]): string {
  return renderToStaticMarkup(createElement(BotaoBola, props));
}

describe("bola de entrar", () => {
  it("é o botão de enviar, com a palavra Entrar e o nome da pessoa", () => {
    const html = desenhar({ rotuloAcessivel: "Entrar como Francisco" });
    expect(html).toMatch(/^<button type="submit"/);
    expect(html).toContain('aria-label="Entrar como Francisco"');
    expect(html).toContain(">Entrar</span>");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("aria-busy");
  });

  it("entrando: travada, ocupada e com o texto Entrando…", () => {
    const html = desenhar({ entrando: true, rotuloAcessivel: "Entrar no sistema" });
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Entrando…");
  });
});
