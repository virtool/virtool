import { createQueryKeys } from "@app/queryKeys";

/**
 * Query keys for uploaded files.
 *
 * The upload type leads the filters, so every list of a given type sits under
 * a common prefix.
 */
export const fileQueryKeys = createQueryKeys("uploads");

/** Query keys for the instance upload policy. */
export const uploadPolicyQueryKeys = createQueryKeys("uploadPolicy");
