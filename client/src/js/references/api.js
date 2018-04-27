import Request from "superagent";

export const list = () => (
    Request.get("/api/refs")
);

export const get = ({ refId }) => (
    Request.get(`/api/refs/${refId}`)
);

export const create = ({ name, description }) => (
    Request.post("/api/refs")
        .send({
            name,
            description
        })
);
