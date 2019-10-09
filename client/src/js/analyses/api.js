import Request from "superagent";

export const find = ({ sampleId, term, page = 1 }) =>
    Request.get(`/api/samples/${sampleId}/analyses`).query({ find: term, page });

export const get = ({ analysisId }) => Request.get(`/api/analyses/${analysisId}`);

export const analyze = ({ sampleId, refId, subtractionId, algorithm }) =>
    Request.post(`/api/samples/${sampleId}/analyses`).send({
        algorithm,
        ref_id: refId,
        subtraction_id: subtractionId
    });

export const blastNuvs = ({ analysisId, sequenceIndex }) =>
    Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {});

export const remove = ({ analysisId }) => Request.delete(`/api/analyses/${analysisId}`);
