import Request from "superagent";

export const find = () => (
    Request.get(`/api${window.location.pathname}`)
);

export const get = ({ indexId }) => (
    Request.get(`/api/indexes/${indexId}`)
);

export const getUnbuilt = ({ refId }) => (
    Request.get(`/api/refs/${refId}/history?unbuilt=true`)
);

export const create = ({ refId }) => (
    Request.post(`/api/refs/${refId}/indexes`)
);

export const getHistory = ({ indexVersion, page = 1 }) => (
    Request.get(`/api/indexes/${indexVersion}/history?page=${page}`)
);
