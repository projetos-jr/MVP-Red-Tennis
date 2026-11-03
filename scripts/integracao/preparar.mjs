/**
 * Prepara o Supabase LOCAL para os testes de integracao (npm run test:integracao):
 * cria tres usuarios de teste (dono, recepcao, professor) e libera cada um em
 * `colaboradores`.
 *
 * So para o Supabase local (`npx supabase start`) ou o do CI: usa a chave
 * secreta PADRAO do ambiente local, que nao vale em nenhum projeto real.
 * Nunca rode isto apontando para o projeto de teste ou de producao.
 *
 *   SUPABASE_TESTE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TESTE_CHAVE_SECRETA=<SERVICE_ROLE_KEY de `npx supabase status -o env`> \
 *   node scripts/integracao/preparar.mjs
 */

const url = process.env.SUPABASE_TESTE_URL;
const chave = process.env.SUPABASE_TESTE_CHAVE_SECRETA;
const senha = process.env.SUPABASE_TESTE_SENHA ?? "senha-local-123";

if (!url || !chave) {
  console.error("Defina SUPABASE_TESTE_URL e SUPABASE_TESTE_CHAVE_SECRETA (veja o cabecalho).");
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Recusado: ${url} nao e um Supabase local.`);
  process.exit(1);
}

const cabecalhos = {
  apikey: chave,
  Authorization: `Bearer ${chave}`,
  "Content-Type": "application/json",
};

async function pedir(caminho, opcoes = {}) {
  const resposta = await fetch(`${url}${caminho}`, { headers: cabecalhos, ...opcoes });
  const texto = await resposta.text();
  return { ok: resposta.ok, status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

const { corpo: professores } = await pedir("/rest/v1/professores?select=id&order=id&limit=1");
const professorId = professores?.[0]?.id ?? null;

const pessoas = [
  { email: "dono@teste.local", nome: "Dono Local", cargo: "Diretor", perfil: "dono", professor_id: null },
  { email: "recepcao@teste.local", nome: "Recepção Local", cargo: "Recepção", perfil: "recepcao", professor_id: null },
  { email: "professor@teste.local", nome: "Professor Local", cargo: "Professor", perfil: "professor", professor_id: professorId },
];

const { corpo: lista } = await pedir("/auth/v1/admin/users?per_page=1000");
const existentes = new Map((lista?.users ?? []).map((u) => [u.email, u.id]));

for (const pessoa of pessoas) {
  let id = existentes.get(pessoa.email);
  if (!id) {
    const criado = await pedir("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: pessoa.email, password: senha, email_confirm: true }),
    });
    if (!criado.ok) throw new Error(`Usuario ${pessoa.email}: ${JSON.stringify(criado.corpo)}`);
    id = criado.corpo.id;
  }
  const { email, ...colaborador } = pessoa;
  void email;
  const liberado = await pedir("/rest/v1/colaboradores?on_conflict=id", {
    method: "POST",
    headers: { ...cabecalhos, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id, ...colaborador, ativo: true }),
  });
  if (!liberado.ok) throw new Error(`Colaborador ${pessoa.email}: ${JSON.stringify(liberado.corpo)}`);
  console.log(`ok: ${pessoa.email} (${pessoa.perfil})`);
}
