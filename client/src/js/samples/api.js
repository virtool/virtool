import Request from "superagent";

export const find = () => (
    Request.get(`/api/samples${window.location.search}`)
);

export const findReadyHosts = () => (
    Request.get("/api/subtraction")
        .query({
            ready: true,
            is_host: true
        })
);

export const get = ({ sampleId }) => (
    Request.get(`/api/samples/${sampleId}`)
);

export const create = ({ name, isolate, host, locale, subtraction, files }) => (
    Request.post("/api/samples")
        .send({
            name,
            isolate,
            host,
            locale,
            subtraction,
            files
        })
);

export const update = ({ sampleId, update }) => (
    Request.patch(`/api/samples/${sampleId}`)
        .send(update)
);

export const updateGroup = ({ sampleId, groupId }) => (
    Request.put(`/api/samples/${sampleId}/group`)
        .send({
            group_id: groupId
        })
);

export const updateRights = ({ sampleId, update }) => (
    Request.patch(`/api/samples/${sampleId}/rights`)
        .send(update)
);

export const remove = ({ sampleId }) => (
    Request.delete(`/api/samples/${sampleId}`)
);

export const findAnalyses = ({ sampleId }) => (
    Request.get(`/api/samples/${sampleId}/analyses`)
);

export const getAnalysis = (analysisId, onProgress, onSuccess, onFailure) => (
    Request.get(`/api/analyses/${analysisId}`)
        .on("progress", onProgress)
        .then(res => onSuccess(res))
        .catch(err => onFailure(err))
);

export const analyze = ({ sampleId, algorithm }) => (
    Request.post(`/api/samples/${sampleId}/analyses`)
        .send({algorithm})
);

export const blastNuvs = ({ analysisId, sequenceIndex}) => (
    Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {})
);

export const removeAnalysis = ({ analysisId }) => (
    Request.delete(`/api/analyses/${analysisId}`)
);
