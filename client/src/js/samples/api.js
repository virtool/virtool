import Request from "superagent";

export const find = ({ term, page }) =>
    Request.get("/api/samples").query({
        find: term,
        page
    });

export const filter = ({ term }) => Request.get(`/api/samples?find=${term}`);

export const findReadyHosts = () =>
    Request.get("/api/subtractions").query({
        ready: true,
        is_host: true
    });

export const get = ({ sampleId }) => Request.get(`/api/samples/${sampleId}`);

export const create = action => Request.post("/api/samples").send(action);

export const update = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}`).send(update);

export const updateRights = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}/rights`).send(update);

export const remove = ({ sampleId }) => Request.delete(`/api/samples/${sampleId}`);
