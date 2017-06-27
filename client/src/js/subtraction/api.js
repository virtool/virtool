/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const subtractionAPI = {

    find: () => {
        return Request.get("/api/subtraction");
    },

    get: (subtractionId) => {
        return Request.get(`/api/subtraction/${subtractionId}`);
    },

    remove: (subId) => {
        return Request.delete(`/api/subtraction/${subId}`);
    }

};

export default subtractionAPI;
