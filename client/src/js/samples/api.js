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

    find: (term, page) => {
        const params = {};

        if (term) {
            params["term"] = term;
        }

        params["page"] = page;

        return Request.get("/api/samples")
            .query(params);
    },

    findReadyHosts: () => {
        return Request.get("/api/subtraction")
            .query({"ready": true, "is_host": true});
    },

    get: (sampleId) => {
        return Request.get(`/api/samples/${sampleId}`);
    },

    create: (name, isolate, host, locale, subtraction, files) => {
        return Request.post("/api/samples")
            .send({
                name,
                isolate,
                host,
                locale,
                subtraction,
                files
            });
    },

    update: (sampleId, update) => {
        return Request.patch(`/api/samples/${sampleId}`)
            .send(update);
    },

    updateGroup: (sampleId, groupId) => {
        return Request.put(`/api/samples/${sampleId}/group`)
            .send({
                group_id: groupId
            });
    },

    updateRights: (sampleId, update) => {
        return Request.patch(`/api/samples/${sampleId}/rights`)
            .send(update);
    },

    remove: (sampleId) => {
        return Request.delete(`/api/samples/${sampleId}`);
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
    },

    blastNuvs: (analysisId, sequenceIndex) => {
        return Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {});
    },

    removeAnalysis: (analysisId) => {
        return Request.delete(`/api/analyses/${analysisId}`);
    }
};

export default samplesAPI;
