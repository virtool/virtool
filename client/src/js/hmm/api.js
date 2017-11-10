/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const hmmsAPI = {

    find: (query) => {
        query.page = query.page || 1;

        return Request
            .get("/api/hmms")
            .query(query);
    },

    install: () => {
        return Request.post("/api/hmms");
    },

    get: (hmmId) => {
        return Request.get(`/api/hmms/annotations/${hmmId}`);
    }
};

export default hmmsAPI;
