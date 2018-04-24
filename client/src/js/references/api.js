import Request from "superagent";

export const list = () => (
    Request.get("/api/refs")
);

export const get = ({ refId }) => (
    Request.get(`/api/refs/${refId}`)
);
