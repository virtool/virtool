import Request from "superagent";

export const find = () => (
    Request.get(`/api/otu${window.location.search}`)
);

export const listNames = () => (
    Request.get("/api/otu?names=true")
);

export const get = ({ OTUId }) => (
    Request.get(`/api/otu/${OTUId}`)
);

export const getHistory = ({ OTUId }) => (
    Request.get(`/api/otu/${OTUId}/history`)
);

export const getGenbank = (accession) => (
    Request.get(`/api/genbank/${accession}`)
);

export const create = ({ name, abbreviation }) => (
    Request.post("/api/otu")
        .send({
            name,
            abbreviation
        })
);

export const edit = ({ OTUId, name, abbreviation, schema }) => (
    Request.patch(`/api/otu/${OTUId}`)
        .send({
            name,
            abbreviation,
            schema
        })
);

export const remove = ({ OTUId }) => (
    Request.delete(`/api/otu/${OTUId}`)
);

export const addIsolate = ({ OTUId, sourceType, sourceName }) => (
    Request.post(`/api/otu/${OTUId}/isolates`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const editIsolate = ({ OTUId, isolateId, sourceType, sourceName }) => (
    Request.patch(`/api/otu/${OTUId}/isolates/${isolateId}`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const setIsolateAsDefault = ({ OTUId, isolateId }) => (
    Request.put(`/api/otu/${OTUId}/isolates/${isolateId}/default`)
);

export const removeIsolate = ({ OTUId, isolateId }) => (
    Request.delete(`/api/otu/${OTUId}/isolates/${isolateId}`)
);

export const addSequence = ({ OTUId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.post(`/api/otu/${OTUId}/isolates/${isolateId}/sequences`)
        .send({
            id: sequenceId,
            definition,
            host,
            sequence,
            segment
        })
);

export const editSequence = ({ OTUId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.patch(`/api/otu/${OTUId}/isolates/${isolateId}/sequences/${sequenceId}`)
        .send({
            definition,
            host,
            sequence,
            segment
        })
);

export const removeSequence = ({ OTUId, isolateId, sequenceId }) => (
    Request.delete(`/api/otu/${OTUId}/isolates/${isolateId}/sequences/${sequenceId}`)
);

export const revert = ({ OTUId, version }) => (
    Request.delete(`/api/history/${OTUId}.${version}`)
);

export const getImport = ({ fileId }) => (
    Request.get("/api/otu/import")
        .query({file_id: fileId})
);

export const commitImport = ({ fileId }) => (
    Request.post("/api/otu/import")
        .send({file_id: fileId})
);
