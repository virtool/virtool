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

    create: () => {
        return Request.post("/api/indexes");
    }
};

export default indexesAPI;
