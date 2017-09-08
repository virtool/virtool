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

    getUnbuilt: () => {
        return Request.get("/api/indexes/unbuilt");
    },

    create: () => {
        return Request.post("/api/indexes");
    },

    getHistory: (indexVersion) => {
        return Request.get(`/api/indexes/${indexVersion}/history`);
    }
};

export default indexesAPI;
