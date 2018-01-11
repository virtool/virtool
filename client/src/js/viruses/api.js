import Request from "superagent";

export const find = () => (
    Request.get(`/api/viruses${window.location.search}`)
);

export const listNames = () => (
    Request.get("/api/viruses?names=true")
);

export const get = ({ virusId }) => (
    Request.get(`/api/viruses/${virusId}`)
);

export const getHistory = ({ virusId }) => (
    Request.get(`/api/viruses/${virusId}/history`)
);

export const getGenbank = (accession) => (
    Request.get(`/api/genbank/${accession}`)
);

export const create = ({ name, abbreviation }) => (
    Request.post("/api/viruses")
        .send({
            name,
            abbreviation
        })
);

export const edit = ({ virusId, name, abbreviation }) => (
    Request.patch(`/api/viruses/${virusId}`)
        .send({
            name,
            abbreviation
        })
);

export const remove = ({ virusId }) => (
    Request.delete(`/api/viruses/${virusId}`)
);

export const addIsolate = ({ virusId, sourceType, sourceName }) => (
    Request.post(`/api/viruses/${virusId}/isolates`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const editIsolate = ({ virusId, isolateId, sourceType, sourceName }) => (
    Request.patch(`/api/viruses/${virusId}/isolates/${isolateId}`)
        .send({
            source_type: sourceType,
            source_name: sourceName
        })
);

export const setIsolateAsDefault = ({ virusId, isolateId }) => (
    Request.put(`/api/viruses/${virusId}/isolates/${isolateId}/default`)
);

export const removeIsolate = ({ virusId, isolateId }) => (
    Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}`)
);

export const addSequence = ({ virusId, isolateId, sequenceId, definition, host, sequence }) => (
    Request.post(`/api/viruses/${virusId}/isolates/${isolateId}/sequences`)
        .send({
            id: sequenceId,
            definition,
            host,
            sequence
        })
);

export const editSequence = ({ virusId, isolateId, sequenceId, definition, host, sequence }) => (
    Request.patch(`/api/viruses/${virusId}/isolates/${isolateId}/sequences/${sequenceId}`)
        .send({
            definition,
            host,
            sequence
        })
);

export const removeSequence = ({ virusId, isolateId, sequenceId }) => (
    Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}/sequences/${sequenceId}`)
);

export const revert = ({ virusId, version }) => (
    Request.delete(`/api/history/${virusId}.${version}`)
);

export const getImport = ({ fileId }) => (
    Request.get("/api/viruses/import")
        .query({file_id: fileId})
);

export const commitImport = ({ fileId }) => (
    Request.post("/api/viruses/import")
        .send({file_id: fileId})
);
