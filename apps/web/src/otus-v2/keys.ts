import { createQueryKeys } from "@app/queryKeys";

// A dedicated domain so v2 invalidation never collides with the legacy `otus`
// keys, their SSE-driven refetches, or v1 query behavior.
export const otuV2QueryKeys = createQueryKeys("otus-v2");
