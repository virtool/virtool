/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const virusesAPI = {

    find: (term, page) => {
        let query = {};

        if (term) {
            query.term = term;
        }

        query.page = page;

        return Request
            .get("/api/viruses")
            .query(query);
    },

    get: (virusId) => {
        return Request.get(`/api/viruses/${virusId}`);
    },

    getHistory: (virusId) => {
        return Request.get(`/api/viruses/${virusId}/history`);
    },

    create: (name, abbreviation) => {
        return Request.post("/api/viruses")
            .send({
                name,
                abbreviation
            });
    },

    addIsolate: (virusId, sourceType, sourceName) => {
        return Request.post(`/api/viruses/${virusId}/isolates`)
            .send({
                source_type: sourceType,
                source_name: sourceName
            });
    },

    editIsolate: (virusId, isolateId, sourceType, sourceName) => {
        return Request.patch(`/api/viruses/${virusId}/isolates/${isolateId}`)
            .send({
                source_type: sourceType,
                source_name: sourceName
            });
    },

    removeIsolate: (virusId, isolateId) => {
        return Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}`);
    }

};

export default virusesAPI;
