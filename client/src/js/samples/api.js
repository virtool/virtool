/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const samplesAPI = {

    find: (term) => {
        const params = {};

        if (term) {
            params["find"] = term;
        }

        return Request.get("/api/samples")
            .query(params);
    },

    get: (sampleId) => {
        return Request.get(`/api/samples/${sampleId}`);
    },

    update: (sampleId, update) => {
        return Request.patch(`/api/samples/${sampleId}`)
            .send(update);
    },

    findAnalyses: (sampleId) => {
        return Request.get(`/api/samples/${sampleId}/analyses`)
    },

    getAnalysis: (analysisId) => {
        return Request.get(`/api/analyses/${analysisId}`);
    },

    analyze: (sampleId, algorithm) => {
        return Request.post(`/api/samples/${sampleId}/analyses`)
            .send({
                algorithm: algorithm
            });
    }

};

export default samplesAPI;
