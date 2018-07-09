import Request from "superagent";

export const findAnalyses = ({ sampleId }) => (
    Request.get(`/api/samples/${sampleId}/analyses`)
);

export const getAnalysis = (analysisId, onProgress, onSuccess, onFailure) => (
    Request.get(`/api/analyses/${analysisId}`)
        .on("progress", onProgress)
        .then(res => onSuccess(res))
        .catch(err => onFailure(err))
);

export const analyze = ({ sampleId, refId, algorithm }) => (
    Request.post(`/api/samples/${sampleId}/analyses`)
        .send({ algorithm, ref_id: refId })
);

export const blastNuvs = ({ analysisId, sequenceIndex}) => (
    Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {})
);

export const removeAnalysis = ({ analysisId }) => (
    Request.delete(`/api/analyses/${analysisId}`)
);
