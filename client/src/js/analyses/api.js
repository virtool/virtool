import { Request } from "../app/request";

export const find = ({ sampleId, term, page = 1 }) =>
    Request.get(`/api/samples/${sampleId}/analyses`).query({ find: term, page });

export const get = ({ analysisId }) => Request.get(`/api/analyses/${analysisId}`);

export const analyze = ({ sampleId, refId, subtractionIds, workflow }) =>
    Request.post(`/api/samples/${sampleId}/analyses`).send({
        workflow,
        ref_id: refId,
        subtractions: subtractionIds
    });

export const blastNuvs = ({ analysisId, sequenceIndex }) =>
    Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {});

export const remove = ({ analysisId }) => Request.delete(`/api/analyses/${analysisId}`);
