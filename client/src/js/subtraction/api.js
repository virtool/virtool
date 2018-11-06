import Request from "superagent";

export const find = ({ term, page }) => Request.get("/api/subtractions").query({ find: term, page });

export const get = ({ subtractionId }) => Request.get(`/api/subtractions/${subtractionId}`);

export const create = ({ subtractionId, fileId, nickname }) =>
    Request.post("/api/subtractions").send({
        subtraction_id: subtractionId,
        file_id: fileId,
        nickname
    });

export const update = ({ subtractionId, nickname }) =>
    Request.patch(`/api/subtractions/${subtractionId}`).send({ nickname });

export const remove = ({ subtractionId }) => Request.delete(`/api/subtractions/${subtractionId}`);
