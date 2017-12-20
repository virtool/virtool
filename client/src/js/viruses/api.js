import Request from "superagent";

const virusesAPI = {

    find: () => (
        Request.get(`/api/viruses${window.location.search}`)
    ),

    listNames: () => (
        Request.get("/api/viruses?names=true")
    ),

    get: ({ virusId }) => (
        Request.get(`/api/viruses/${virusId}`)
    ),

    getHistory: ({ virusId }) => (
        Request.get(`/api/viruses/${virusId}/history`)
    ),

    getGenbank: ({ accession }) => (
        Request.get(`/api/genbank/${accession}`)
    ),

    create: ({ name, abbreviation }) => (
        Request.post("/api/viruses")
            .send({
                name,
                abbreviation
            })
    ),

    edit: ({ virusId, name, abbreviation }) => (
        Request.patch(`/api/viruses/${virusId}`)
            .send({
                name,
                abbreviation
            })
    ),

    remove: ({ virusId }) => (
        Request.delete(`/api/viruses/${virusId}`)
    ),

    addIsolate: ({ virusId, sourceType, sourceName }) => (
        Request.post(`/api/viruses/${virusId}/isolates`)
            .send({
                source_type: sourceType,
                source_name: sourceName
            })
    ),

    editIsolate: ({ virusId, isolateId, sourceType, sourceName }) => (
        Request.patch(`/api/viruses/${virusId}/isolates/${isolateId}`)
            .send({
                source_type: sourceType,
                source_name: sourceName
            })
    ),

    setIsolateAsDefault: ({ virusId, isolateId }) => (
        Request.put(`/api/viruses/${virusId}/isolates/${isolateId}/default`)
    ),

    removeIsolate: ({ virusId, isolateId }) => (
        Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}`)
    ),

    addSequence: ({ virusId, isolateId, sequenceId, definition, host, sequence }) => (
        Request.post(`/api/viruses/${virusId}/isolates/${isolateId}/sequences`)
            .send({
                id: sequenceId,
                definition,
                host,
                sequence
            })
    ),

    editSequence: ({ virusId, isolateId, sequenceId, definition, host, sequence }) => (
        Request.patch(`/api/viruses/${virusId}/isolates/${isolateId}/sequences/${sequenceId}`)
            .send({
                definition,
                host,
                sequence
            })
    ),

    removeSequence: ({ virusId, isolateId, sequenceId }) => (
        Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}/sequences/${sequenceId}`)
    ),

    revert: ({ virusId, version }) => (
        Request.delete(`/api/history/${virusId}.${version}`)
    ),

    getImport: ({ fileId }) => (
        Request.get("/api/viruses/import")
            .query({file_id: fileId})
    ),

    commitImport: ({ fileId }) => (
        Request.post("/api/viruses/import")
            .send({file_id: fileId})
    )
};

export default virusesAPI;
