import { getRepoReleases } from "@utils/releases";

const repoMap = {
  hmms: ["virtool-hmm"],
  references: ["ref-plant-viruses"],
  virtool: ["virtool"],
};

export async function GET({ params }): Promise<Response> {
  const repoNames = repoMap[params.id];

  const data = {};

  for (const name of repoNames) {
    data[name] = await getRepoReleases(name);
  }

  return Response.json(data);
}

export function getStaticPaths() {
  return [
    { params: { id: "hmms" } },
    { params: { id: "references" } },
    { params: { id: "virtool" } },
  ];
}
