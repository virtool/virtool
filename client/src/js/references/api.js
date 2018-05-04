import Request from "superagent";

export const list = () => (
    Request.get("/api/refs")
        .query({ per_page: 100 })
);

export const get = ({ referenceId }) => (
    Request.get(`/api/refs/${referenceId}`)
);

export const create = ({ name, description, dataType, organism, isPublic }) => (
    Request.post("/api/refs")
        .send({
            name,
            description,
            data_type: dataType,
            organism,
            public: isPublic
        })
);

export const remove = ({ refId }) => (
    Request.delete(`/api/refs/${refId}`)
);
