import Request from "superagent";


export const find = () => (
    Request.get(`/api/subtraction${window.location.search}`)
);

export const listIds = () => (
    Request.get("/api/subtraction")
        .query({ids: true})
);

export const get = ({ subtractionId }) => (
    Request.get(`/api/subtraction/${subtractionId}`)
);

export const create = ({ subtractionId, fileId, nickname }) => (
    Request.post("/api/subtraction")
        .send({
            subtraction_id: subtractionId,
            file_id: fileId,
            nickname
        })
);

export const update = ({ subtractionId, nickname }) => (
    Request.patch(`/api/subtraction/${subtractionId}`)
        .send({ nickname })
);

export const remove = ({ subtractionId }) => (
    Request.delete(`/api/subtraction/${subtractionId}`)
);
