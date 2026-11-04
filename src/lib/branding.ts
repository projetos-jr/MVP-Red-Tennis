/**
 * Arquivos da marca Red Tennis.
 *
 * As imagens são o logo oficial da arena, recortado com fundo transparente
 * para assentar sobre qualquer superfície.
 *
 * - `LOGO_COMPLETO`: a quadra em curva sobre o letreiro RED TENNIS. Usado onde
 *   a marca é o elemento principal da tela (login).
 * - `LOGO_MARCA`: apenas a quadra. Usado em espaços estreitos, como a topbar,
 *   onde o letreiro ficaria ilegível e o nome já aparece como texto ao lado.
 *
 * Para trocar o logo: substitua os arquivos em `public/` mantendo os nomes, ou
 * aponte as constantes abaixo para os novos caminhos.
 */
export const LOGO_COMPLETO = "/logo-red-tennis.webp";
export const LOGO_MARCA = "/logo-red-tennis-marca.webp";

/** Proporções dos arquivos, para reservar o espaço e evitar salto no layout. */
export const PROPORCAO_LOGO = { completo: 447 / 311, marca: 447 / 150 };

/**
 * Endereço do site da arena, aberto pelo atalho "Site" do Início (em nova aba).
 *
 * VAZIO de propósito: o endereço ainda não foi confirmado pelo cliente
 * (o site atual não tem HTTPS). Enquanto estiver vazio, o atalho não aparece.
 * Para ligar: escreva o endereço completo, por exemplo "https://www.exemplo.com.br".
 */
export const SITE_DA_ARENA = "";
