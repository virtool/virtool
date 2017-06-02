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
    }

};

export default samplesAPI;
