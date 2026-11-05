import type { APIContext } from "astro";
import { getRepoReleases } from "@utils/releases";

const repoMap = {
  hmms: ["virtool-hmm"],
  references: ["ref-plant-viruses"],
};

export async function GET({ params }: APIContext): Promise<Response> {
  const repoNames = repoMap[params.id as keyof typeof repoMap];

  const data: Record<string, object[]> = {};

  for (const name of repoNames) {
    data[name] = await getRepoReleases(name);
  }

  return Response.json(data);
}

export function getStaticPaths() {
  return [
    { params: { id: "hmms" } },
    { params: { id: "references" } },
  ];
}
