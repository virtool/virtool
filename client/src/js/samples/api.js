import { Request } from "../app/request";

export const find = ({ parameters }) => {
    const { term, labels, page, pathoscope, nuvs } = parameters;

    const request = Request.get("/api/samples").query({
        pathoscope,
        nuvs,
        page
    });

    if (term) {
        request.query({ find: term });
    }

    if (labels) {
        labels.forEach(label => request.query({ label }));
    }

    request.sortQuery();

    return request;
};

export const filter = ({ term }) => Request.get(`/api/samples?find=${term}`);

export const get = ({ sampleId }) => Request.get(`/api/samples/${sampleId}`);

export const create = action => {
    const { name, isolate, host, locale, libraryType, subtraction, files } = action;
    return Request.post("/api/samples").send({
        name,
        isolate,
        host,
        locale,
        subtraction,
        files,
        library_type: libraryType
    });
};

export const update = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}`).send(update);

export const updateRights = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}/rights`).send(update);

export const remove = ({ sampleId }) => Request.delete(`/api/samples/${sampleId}`);
