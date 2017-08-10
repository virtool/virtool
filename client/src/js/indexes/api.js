/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const indexesAPI = {

    find: () => {
        return Request.get("/api/indexes")
    },

    get: (indexVersion) => {
        return Request.get(`/api/indexes/${indexVersion}`);
    },

    create: () => {
        return Request.post("/api/indexes");
    },

    getIndexHistory: (indexVersion) => {
        return Request.get(`/api/indexes/${indexVersion}/history`);
    }
};

export default indexesAPI;
