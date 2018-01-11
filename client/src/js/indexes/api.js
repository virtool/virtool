import Request from "superagent";

export const find = () => (
    Request.get("/api/indexes")
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

export const getHistory = ({ indexVersion }) => (
    Request.get(`/api/indexes/${indexVersion}/history`)
);
