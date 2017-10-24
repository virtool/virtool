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

    listIds: () => {
        return Request.get("/api/subtraction")
            .query({ids: true});
    },

    get: (subtractionId) => {
        return Request.get(`/api/subtraction/${subtractionId}`);
    },

    create: (subtractionId, fileId) => {
        return Request.post("/api/subtraction")
            .send({
                subtraction_id: subtractionId,
                file_id: fileId
            });
    },

    remove: (subId) => {
        return Request.delete(`/api/subtraction/${subId}`);
    }

};

export default subtractionAPI;
