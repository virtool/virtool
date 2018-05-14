import Request from "superagent";

export const find = () => (
    Request.get(`/api${window.location.pathname}`)
);

export const get = ({ indexVersion }) => (
    Request.get(`/api/indexes/${indexVersion}`)
);

export const getUnbuilt = () => (
    Request.get("/api/indexes/unbuilt")
);

export const create = () => (
    Request.post("/api/indexes")
);

export const getHistory = ({ indexVersion, page = 1 }) => (
    Request.get(`/api/indexes/${indexVersion}/history?page=${page}`)
);
