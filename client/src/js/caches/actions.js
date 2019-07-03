import { GET_CACHE } from "../app/actionTypes";

export const getCache = cacheId => ({
    type: GET_CACHE.REQUESTED,
    cacheId
});
