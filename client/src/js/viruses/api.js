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

    find: (findParams) => {
        if (!findParams.find) {
            delete findParams["find"];
        }

        return Request
            .get("/api/viruses")
            .query(findParams);
    },

    get: (virusId) => {
        return Request.get(`/api/viruses/${virusId}`);
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

    removeIsolate: (virusId, isolateId) => {
        return Request.delete(`/api/viruses/${virusId}/isolates/${isolateId}`);
    }

};

export default virusesAPI;
