/**
 * Conferencia visual de todas as telas (capturas + numeros), para comparar
 * antes e depois de uma mudanca de visual.
 *
 * Mede, em cada tela e em cada tamanho:
 *  - erros no console e na pagina;
 *  - rolagem para o lado no celular;
 *  - textos com contraste abaixo do minimo (4,5:1; 3:1 para texto grande);
 *  - alvos de toque menores que 44px (tablet e celular).
 *
 * Uso (com o site rodando em modo demonstracao, sem as variaveis do Supabase):
 *
 *   npm run build && npx next start -p 3600
 *   node scripts/visual/conferir-telas.cjs --base http://127.0.0.1:3600 --saida telas-para-ver/depois
 *
 * Opcoes: --perfis dono,recepcao,professor   --tamanhos computador,tablet,celular   --telas inicio,agenda
 *
 * Usa o Playwright instalado no ambiente (require("playwright")). Saida: uma
 * captura por tela e um relatorio.md + relatorio.json na pasta de saida.
 *
 * Fundo com textura ou gradiente: o componente declara a cor de referencia em
 * `data-fundo-de-contraste="#C8460B"`; sem isso, o texto entra na lista
 * "conferir a mao" (nao conta como falha).
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : padrao;
}

const BASE = argumento("base", "http://127.0.0.1:3600");
const SAIDA = argumento("saida", "telas-para-ver/conferencia");
const PERFIS = argumento("perfis", "dono,recepcao,professor").split(",");
const TAMANHOS_PEDIDOS = argumento("tamanhos", "computador,tablet,celular").split(",");
const TELAS_PEDIDAS = argumento("telas", "");

const TAMANHOS = {
  computador: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  tablet: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false },
  celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};

const NOME_DO_PERFIL = { dono: "Dono", recepcao: "Recepção", professor: "Professor" };

/** Telas conferidas. `perfis` limita quem abre (o professor so ve agenda e alunos). */
const TELAS = [
  { nome: "inicio", url: "/dashboard", perfis: ["dono", "recepcao"] },
  { nome: "agenda", url: "/agenda" },
  { nome: "agenda-quadra", url: "/agenda?visao=quadra&quadra=2" },
  { nome: "agenda-professor", url: "/agenda?visao=professor&professor=prof-2", perfis: ["dono", "recepcao"] },
  { nome: "agenda-mes", url: "/agenda?visao=mes" },
  { nome: "agenda-lap", url: "/agenda?tipo=LAP" },
  { nome: "agenda-novo-horario", url: "/agenda", acao: "novo-horario", perfis: ["dono", "recepcao"] },
  { nome: "modo-quadra", url: "/agenda/quadra?quadra=1" },
  { nome: "imprimir", url: "/agenda/imprimir", perfis: ["dono"] },
  { nome: "clientes", url: "/alunos" },
  { nome: "clientes-busca", url: "/alunos?busca=ana", perfis: ["dono"] },
  { nome: "ficha-aluno", url: "/alunos/a01" },
  { nome: "professores", url: "/professores", perfis: ["dono", "recepcao"] },
  { nome: "ficha-professor", url: "/professores/prof-1", perfis: ["dono"] },
  { nome: "financeiro", url: "/financeiro", perfis: ["dono", "recepcao"] },
  { nome: "estoque", url: "/estoque", perfis: ["dono", "recepcao"] },
  { nome: "produto", url: "/estoque/produto?id=p03", perfis: ["dono"] },
  { nome: "ranking", url: "/ranking", perfis: ["dono", "recepcao"] },
  { nome: "torneios", url: "/ranking?aba=torneios", perfis: ["dono"] },
  { nome: "torneio", url: "/ranking/torneio?id=t-1", perfis: ["dono"] },
  { nome: "configuracoes", url: "/configuracoes", perfis: ["dono"] },
  { nome: "historico", url: "/historico", perfis: ["dono"] },
];

/** Roda dentro da pagina: mede contraste, alvos de toque e rolagem lateral. */
function medirNaPagina(comToque) {
  const LIMITE_TOQUE = 44;

  function rgba(texto) {
    const m = texto.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(/[,\s/]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  }
  function hex(texto) {
    const h = texto.replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  function sobre(cima, baixo) {
    const a = cima.a;
    return { r: cima.r * a + baixo.r * (1 - a), g: cima.g * a + baixo.g * (1 - a), b: cima.b * a + baixo.b * (1 - a), a: 1 };
  }
  function luminancia(c) {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contraste(a, b) {
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }

  /** Fundo efetivo: sobe pelos ancestrais juntando as transparencias. */
  function fundoDe(el) {
    const camadas = [];
    let manual = false;
    for (let no = el; no && no.nodeType === 1; no = no.parentElement) {
      const declarado = no.getAttribute && no.getAttribute("data-fundo-de-contraste");
      if (declarado) {
        camadas.push(hex(declarado));
        break;
      }
      const estilo = getComputedStyle(no);
      if (estilo.backgroundImage && estilo.backgroundImage !== "none" && !estilo.backgroundImage.startsWith("url(")) {
        manual = true;
      }
      const cor = rgba(estilo.backgroundColor);
      if (cor && cor.a > 0) {
        camadas.push(cor);
        if (cor.a >= 1) break;
      }
    }
    let fundo = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = camadas.length - 1; i >= 0; i--) fundo = sobre(camadas[i], fundo);
    return { fundo, manual };
  }

  function visivel(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const estilo = getComputedStyle(el);
    if (estilo.visibility === "hidden" || estilo.display === "none") return false;
    if (el.closest("[aria-hidden='true']")) return false;
    // Somente leitores de tela (sr-only).
    if (estilo.position === "absolute" && r.width <= 1 && r.height <= 1) return false;
    return true;
  }

  function opacidadeAcumulada(el) {
    let o = 1;
    for (let no = el; no && no.nodeType === 1; no = no.parentElement) o *= parseFloat(getComputedStyle(no).opacity || "1");
    return o;
  }

  const falhas = [];
  const manuais = [];
  let textosConferidos = 0;
  const vistos = new Set();
  const percorrer = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (percorrer.nextNode()) {
    const no = percorrer.currentNode;
    const texto = no.textContent.trim();
    if (!texto) continue;
    const el = no.parentElement;
    if (!el || vistos.has(el) || !visivel(el)) continue;
    if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
    vistos.add(el);
    const estilo = getComputedStyle(el);
    const cor = rgba(estilo.color);
    if (!cor) continue;
    const { fundo, manual } = fundoDe(el);
    const op = opacidadeAcumulada(el);
    const efetiva = sobre({ ...cor, a: cor.a * op }, fundo);
    const tamanho = parseFloat(estilo.fontSize);
    const negrito = parseInt(estilo.fontWeight, 10) >= 700;
    const grande = tamanho >= 24 || (negrito && tamanho >= 18.66);
    const minimo = grande ? 3 : 4.5;
    const razao = contraste(efetiva, fundo);
    textosConferidos++;
    if (razao + 0.005 < minimo) {
      const registro = {
        texto: texto.slice(0, 50),
        razao: Math.round(razao * 100) / 100,
        minimo,
        cor: estilo.color,
        fundo: `rgb(${Math.round(fundo.r)}, ${Math.round(fundo.g)}, ${Math.round(fundo.b)})`,
        tamanho,
        classes: (el.className && el.className.baseVal === undefined ? el.className : "").toString().slice(0, 90),
      };
      (manual ? manuais : falhas).push(registro);
    }
  }

  let toquePequeno = 0;
  const exemplosToque = [];
  if (comToque) {
    const alvos = document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio], summary",
    );
    for (const el of alvos) {
      if (!visivel(el) || el.disabled) continue;
      const r = el.getBoundingClientRect();
      // Checkbox/radio dentro de um rotulo: vale o tamanho do rotulo.
      const rotulo = el.closest("label");
      const medida = rotulo ? rotulo.getBoundingClientRect() : r;
      if (medida.height < LIMITE_TOQUE - 0.5) {
        toquePequeno++;
        if (exemplosToque.length < 8) {
          exemplosToque.push(`${el.tagName.toLowerCase()} ${Math.round(medida.width)}x${Math.round(medida.height)} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
        }
      }
    }
  }

  return {
    rolagemLateral: document.documentElement.scrollWidth > window.innerWidth + 1,
    larguraDoConteudo: document.documentElement.scrollWidth,
    textosConferidos,
    falhasDeContraste: falhas.length,
    exemplosDeContraste: falhas.sort((a, b) => a.razao - b.razao).slice(0, 12),
    conferirAMao: manuais.length,
    exemplosAMao: manuais.slice(0, 5),
    toquePequeno,
    exemplosToque,
  };
}

async function entrar(pagina, perfil) {
  await pagina.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pagina.waitForTimeout(400);
  const rotulo = pagina.locator("label", { hasText: NOME_DO_PERFIL[perfil] }).first();
  if (await rotulo.count()) await rotulo.click();
  await pagina.locator("button[type=submit]").click();
  await pagina.waitForURL((u) => new URL(u).pathname !== "/", { timeout: 20000 });
  await pagina.waitForLoadState("networkidle");
}

async function irPara(pagina, url) {
  await pagina.evaluate((destino) => window.next.router.push(destino), url);
  await pagina.waitForFunction(
    (destino) => window.location.pathname + window.location.search === destino || window.location.pathname === destino.split("?")[0],
    url,
    { timeout: 15000 },
  );
  await pagina.waitForLoadState("networkidle");
  await pagina.waitForTimeout(700);
}

async function fotografar(pagina, arquivo, comToque) {
  if (!comToque) {
    await pagina.screenshot({ path: arquivo, fullPage: true });
    return;
  }
  // Com toque, a captura de pagina inteira desliga a emulacao: aumenta a janela.
  const tamanho = pagina.viewportSize();
  const altura = await pagina.evaluate(() => Math.min(document.documentElement.scrollHeight, 7000));
  await pagina.setViewportSize({ width: tamanho.width, height: Math.max(tamanho.height, altura) });
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: arquivo });
  await pagina.setViewportSize(tamanho);
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const navegador = await chromium.launch();
  const resultados = [];

  for (const nomeDoTamanho of TAMANHOS_PEDIDOS) {
    const tamanho = TAMANHOS[nomeDoTamanho];
    for (const perfil of PERFIS) {
      const contexto = await navegador.newContext({ ...tamanho, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
      const pagina = await contexto.newPage();
      let erros = [];
      pagina.on("pageerror", (e) => erros.push(`pageerror: ${e.message.slice(0, 160)}`));
      pagina.on("console", (m) => {
        if (m.type() === "error") erros.push(`console: ${m.text().slice(0, 160)}`);
      });

      // Login (uma vez por perfil e tamanho).
      if (perfil === PERFIS[0]) {
        await pagina.goto(`${BASE}/`, { waitUntil: "networkidle" });
        await pagina.waitForTimeout(500);
        const medidas = await pagina.evaluate(medirNaPagina, tamanho.hasTouch);
        await fotografar(pagina, path.join(SAIDA, `${nomeDoTamanho}-login.png`), tamanho.hasTouch);
        resultados.push({ tamanho: nomeDoTamanho, perfil: "-", tela: "login", erros, ...medidas });
        erros = [];
      }
      await entrar(pagina, perfil);

      for (const tela of TELAS) {
        if (TELAS_PEDIDAS && !TELAS_PEDIDAS.split(",").includes(tela.nome)) continue;
        if (tela.perfis && !tela.perfis.includes(perfil)) continue;
        erros = [];
        const inicio = Date.now();
        try {
          await irPara(pagina, tela.url);
          if (tela.acao === "novo-horario") {
            const botao = pagina.getByRole("button", { name: /Novo horário/ }).first();
            if (await botao.count()) {
              await botao.click();
              await pagina.waitForTimeout(600);
            }
          }
          const medidas = await pagina.evaluate(medirNaPagina, tamanho.hasTouch);
          const arquivo = `${nomeDoTamanho}-${perfil}-${tela.nome}.png`;
          await fotografar(pagina, path.join(SAIDA, arquivo), tamanho.hasTouch);
          resultados.push({ tamanho: nomeDoTamanho, perfil, tela: tela.nome, ms: Date.now() - inicio, erros: [...erros], arquivo, ...medidas });
          if (tela.acao) await pagina.keyboard.press("Escape");
        } catch (falha) {
          resultados.push({ tamanho: nomeDoTamanho, perfil, tela: tela.nome, erros: [...erros, `falha: ${String(falha.message).slice(0, 200)}`] });
        }
        process.stdout.write(".");
      }
      await contexto.close();
    }
  }
  await navegador.close();

  fs.writeFileSync(path.join(SAIDA, "relatorio.json"), JSON.stringify(resultados, null, 1));

  const soma = (campo) => resultados.reduce((t, r) => t + (r[campo] || 0), 0);
  const linhas = [
    `# Conferência de telas — ${new Date().toISOString()}`,
    "",
    `Base: ${BASE} · ${resultados.length} capturas`,
    "",
    "| Total | Valor |",
    "| --- | --- |",
    `| Erros no console/página | ${resultados.reduce((t, r) => t + (r.erros ? r.erros.length : 0), 0)} |`,
    `| Telas com rolagem lateral | ${resultados.filter((r) => r.rolagemLateral).length} |`,
    `| Textos com contraste abaixo do mínimo | ${soma("falhasDeContraste")} (de ${soma("textosConferidos")}) |`,
    `| Textos sobre textura/gradiente (conferir à mão) | ${soma("conferirAMao")} |`,
    `| Alvos de toque < 44px (tablet+celular) | ${soma("toquePequeno")} |`,
    "",
    "| Tamanho | Perfil | Tela | Erros | Lateral | Contraste | À mão | Toque<44 | ms |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...resultados.map(
      (r) =>
        `| ${r.tamanho} | ${r.perfil} | ${r.tela} | ${r.erros ? r.erros.length : 0} | ${r.rolagemLateral ? "SIM" : ""} | ${r.falhasDeContraste ?? "?"} | ${r.conferirAMao ?? ""} | ${r.toquePequeno ?? ""} | ${r.ms ?? ""} |`,
    ),
    "",
    "## Detalhes",
    ...resultados
      .filter((r) => (r.erros && r.erros.length) || r.falhasDeContraste || r.rolagemLateral)
      .map((r) =>
        [
          `### ${r.tamanho} · ${r.perfil} · ${r.tela}`,
          ...(r.erros || []).map((e) => `- ${e}`),
          ...(r.exemplosDeContraste || []).map((c) => `- contraste ${c.razao} (mín ${c.minimo}) "${c.texto}" cor ${c.cor} sobre ${c.fundo} ${c.tamanho}px \`${c.classes}\``),
          r.rolagemLateral ? `- rolagem lateral: conteúdo com ${r.larguraDoConteudo}px` : "",
        ].join("\n"),
      ),
  ];
  fs.writeFileSync(path.join(SAIDA, "relatorio.md"), linhas.join("\n"));
  console.log(`\nPronto: ${resultados.length} capturas em ${SAIDA}`);
  console.log(linhas.slice(4, 11).join("\n"));
})();
