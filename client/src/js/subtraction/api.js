import { Request } from "../app/request";

export const find = ({ term, page }) => Request.get("/api/subtractions").query({ find: term, page });

export const shortlist = () => Request.get("/api/subtractions?short=true");

export const get = ({ subtractionId }) => Request.get(`/api/subtractions/${subtractionId}`);

export const create = ({ fileId, name, nickname }) =>
    Request.post("/api/subtractions").send({
        file_id: fileId,
        name,
        nickname
    });

export const edit = ({ subtractionId, name, nickname }) =>
    Request.patch(`/api/subtractions/${subtractionId}`).send({ name, nickname });

export const remove = ({ subtractionId }) => Request.delete(`/api/subtractions/${subtractionId}`);
