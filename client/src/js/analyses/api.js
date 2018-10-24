import Request from "superagent";

export const findAnalyses = ({ sampleId }) =>
  Request.get(`/api/samples/${sampleId}/analyses`);

export const filter = ({ sampleId, term }) =>
  Request.get(`/api/samples/${sampleId}/analyses?term=${term}`);

export const getAnalysis = ({ analysisId }) =>
  Request.get(`/api/analyses/${analysisId}`);

export const analyze = ({ sampleId, refId, algorithm }) =>
  Request.post(`/api/samples/${sampleId}/analyses`).send({
    algorithm,
    ref_id: refId
  });

export const blastNuvs = ({ analysisId, sequenceIndex }) =>
  Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {});

export const removeAnalysis = ({ analysisId }) =>
  Request.delete(`/api/analyses/${analysisId}`);
