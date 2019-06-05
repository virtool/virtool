/**
 * Functions for communication with API endpoints related to sample caches.
 *
 * @module files/api
 */
import Request from "superagent";

/**
 * Get the cache record identified get ``cacheId``..
 *
 * @func
 * @param cacheId {string} the id of the cache to get
 * @returns {promise}
 */
export const get = ({ cacheId }) => Request.get(`/api/caches/${cacheId}`);
