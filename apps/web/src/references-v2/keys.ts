import { createQueryKeys } from "@app/queryKeys";

// A dedicated domain so v2 invalidation never collides with the legacy
// `references` keys, their SSE-driven refetches, or v1 query behavior.
export const referenceV2QueryKeys = createQueryKeys("references-v2");
