import Request from "superagent";

export const find = ({ term, page, pathoscope, nuvs }) =>
    Request.get("/api/samples").query({
        find: term,
        pathoscope,
        nuvs,
        page
    });

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

export const uploadSampleFile = ({ sampleId, suffix, file, onProgress, onSuccess, onFailure }) =>
    Request.post(`/upload/samples/${sampleId}/files/${suffix}`)
        .query({ name: file.name })
        .attach("file", file)
        .on("progress", onProgress)
        .then(onSuccess)
        .catch(onFailure);

export const replaceLegacyFiles = ({ sampleId }) => Request.put(`/api/samples/${sampleId}/replacement`);

export const remove = ({ sampleId }) => Request.delete(`/api/samples/${sampleId}`);
