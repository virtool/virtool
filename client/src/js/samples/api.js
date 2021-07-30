import { Request } from "../app/request";

export const find = ({ term, labels, workflows, page = 1 }) => {
    const request = Request.get("/api/samples").query({
        page
    });

    if (term) {
        request.query({ find: term });
    }

    if (workflows) {
        request.query({ workflows });
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
    const { name, isolate, host, locale, libraryType, subtractions, files, group } = action;
    return Request.post("/api/samples").send({
        name,
        isolate,
        host,
        locale,
        subtractions,
        files,
        library_type: libraryType,
        group
    });
};

export const update = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}`).send(update);

export const updateRights = ({ sampleId, update }) => Request.patch(`/api/samples/${sampleId}/rights`).send(update);

export const remove = ({ sampleId }) => Request.delete(`/api/samples/${sampleId}`);
