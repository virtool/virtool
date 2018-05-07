import Request from "superagent";

export const find = () => (
    Request.get(`/api/otu${window.location.search}`)
);

export const listNames = () => (
    Request.get("/api/otu?names=true")
);

export const get = ({ otuId }) => (
    Request.get(`/api/otu/${otuId}`)
);

export const getHistory = ({ otuId }) => (
    Request.get(`/api/otu/${otuId}/history`)
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

export const edit = ({ otuId, name, abbreviation, schema }) => (
    Request.patch(`/api/otu/${otuId}`)
        .send({
            name,
            abbreviation,
            schema
        })
);

export const remove = ({ otuId }) => (
    Request.delete(`/api/otu/${otuId}`)
);

export const addIsolate = ({ otuId, sourceType, sourceName }) => (
    Request.post(`/api/otu/${otuId}/isolates`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const editIsolate = ({ otuId, isolateId, sourceType, sourceName }) => (
    Request.patch(`/api/otu/${otuId}/isolates/${isolateId}`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const setIsolateAsDefault = ({ otuId, isolateId }) => (
    Request.put(`/api/otu/${otuId}/isolates/${isolateId}/default`)
);

export const removeIsolate = ({ otuId, isolateId }) => (
    Request.delete(`/api/otu/${otuId}/isolates/${isolateId}`)
);

export const addSequence = ({ otuId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.post(`/api/otu/${otuId}/isolates/${isolateId}/sequences`)
        .send({
            id: sequenceId,
            definition,
            host,
            sequence,
            segment
        })
);

export const editSequence = ({ otuId, isolateId, sequenceId, definition, host, sequence, segment }) => (
    Request.patch(`/api/otu/${otuId}/isolates/${isolateId}/sequences/${sequenceId}`)
        .send({
            definition,
            host,
            sequence,
            segment
        })
);

export const removeSequence = ({ otuId, isolateId, sequenceId }) => (
    Request.delete(`/api/otu/${otuId}/isolates/${isolateId}/sequences/${sequenceId}`)
);

export const revert = ({ otuId, version }) => (
    Request.delete(`/api/history/${otuId}.${version}`)
);

export const getImport = ({ fileId }) => (
    Request.get("/api/otu/import")
        .query({file_id: fileId})
);

export const commitImport = ({ fileId }) => (
    Request.post("/api/otu/import")
        .send({file_id: fileId})
);
