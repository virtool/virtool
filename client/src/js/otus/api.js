import Request from "superagent";

export const find = () => (
    Request.get(`/api/OTUs${window.location.search}`)
);

export const listNames = () => (
    Request.get("/api/OTUs?names=true")
);

export const get = ({ OTUId }) => (
    Request.get(`/api/OTUs/${OTUId}`)
);

export const getHistory = ({ OTUId }) => (
    Request.get(`/api/OTUs/${OTUId}/history`)
);

export const getGenbank = (accession) => (
    Request.get(`/api/genbank/${accession}`)
);

export const create = ({ name, abbreviation }) => (
    Request.post("/api/OTUs")
        .send({
            name,
            abbreviation
        })
);

export const edit = ({ OTUId, name, abbreviation, schema }) => (
    Request.patch(`/api/OTUs/${OTUId}`)
        .send({
            name,
            abbreviation,
            schema
        })
);

export const remove = ({ OTUId }) => (
    Request.delete(`/api/OTUs/${OTUId}`)
);

export const addIsolate = ({ OTUId, sourceType, sourceName }) => (
    Request.post(`/api/OTUs/${OTUId}/isolates`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const editIsolate = ({ OTUId, isolateId, sourceType, sourceName }) => (
    Request.patch(`/api/OTUs/${OTUId}/isolates/${isolateId}`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const setIsolateAsDefault = ({ OTUId, isolateId }) => (
    Request.put(`/api/OTUs/${OTUId}/isolates/${isolateId}/default`)
);

export const removeIsolate = ({ OTUId, isolateId }) => (
    Request.delete(`/api/OTUs/${OTUId}/isolates/${isolateId}`)
);

export const addSequence = ({ OTUId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.post(`/api/OTUs/${OTUId}/isolates/${isolateId}/sequences`)
        .send({
            id: sequenceId,
            definition,
            host,
            sequence,
            segment
        })
);

export const editSequence = ({ OTUId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.patch(`/api/OTUs/${OTUId}/isolates/${isolateId}/sequences/${sequenceId}`)
        .send({
            definition,
            host,
            sequence,
            segment
        })
);

export const removeSequence = ({ OTUId, isolateId, sequenceId }) => (
    Request.delete(`/api/OTUs/${OTUId}/isolates/${isolateId}/sequences/${sequenceId}`)
);

export const revert = ({ OTUId, version }) => (
    Request.delete(`/api/history/${OTUId}.${version}`)
);

export const getImport = ({ fileId }) => (
    Request.get("/api/OTUs/import")
        .query({file_id: fileId})
);

export const commitImport = ({ fileId }) => (
    Request.post("/api/OTUs/import")
        .send({file_id: fileId})
);
