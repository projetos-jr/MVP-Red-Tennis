import { DetalheDoProduto } from "@/components/estoque/DetalheDoProduto";

/** Detalhe de um produto do estoque: /estoque/produto?id=p12 */
export default async function PaginaDoProduto({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  return <DetalheDoProduto produtoId={typeof id === "string" ? id : ""} />;
}
