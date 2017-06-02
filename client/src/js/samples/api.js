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

        return Request
            .get("/api/samples")
            .query(params);
    }

};

export default samplesAPI;
