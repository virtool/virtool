import { Request } from "../app/request";

/**
 * Get the cache record identified get ``cacheId``..
 *
 * @func
 * @param cacheId {string} the id of the cache to get
 * @returns {promise}
 */
export const get = ({ cacheId }) => Request.get(`/api/caches/${cacheId}`);
