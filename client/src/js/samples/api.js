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

    findReadyHosts: () => (
        Request.get("/api/subtraction")
            .query({
                ready: true,
                is_host: true
            })
    ),

    get: (sampleId) => (
        Request.get(`/api/samples/${sampleId}`)
    ),

    create: (name, isolate, host, locale, subtraction, files) => (
        Request.post("/api/samples")
            .send({
                name,
                isolate,
                host,
                locale,
                subtraction,
                files
            })
    ),

    update: (sampleId, update) => (
        Request.patch(`/api/samples/${sampleId}`)
            .send(update)
    ),

    updateGroup: (sampleId, groupId) => (
        Request.put(`/api/samples/${sampleId}/group`)
            .send({
                group_id: groupId
            })
    ),

    updateRights: (sampleId, update) => (
        Request.patch(`/api/samples/${sampleId}/rights`)
            .send(update)
    ),

    remove: (sampleId) => (
        Request.delete(`/api/samples/${sampleId}`)
    ),

    findAnalyses: (sampleId) => (
        Request.get(`/api/samples/${sampleId}/analyses`)
    ),

    getAnalysis: (analysisId) => (
        Request.get(`/api/analyses/${analysisId}`)
    ),

    analyze: (sampleId, algorithm) => (
        Request.post(`/api/samples/${sampleId}/analyses`)
            .send({algorithm})
    ),

    blastNuvs: (analysisId, sequenceIndex) => (
        Request.put(`/api/analyses/${analysisId}/${sequenceIndex}/blast`, {})
    ),

    removeAnalysis: (analysisId) => (
        Request.delete(`/api/analyses/${analysisId}`)
    )

};

export default samplesAPI;
