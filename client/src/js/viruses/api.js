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

    create: (name, abbreviation) => {
        return Request.post("/api/viruses")
            .send({
                name,
                abbreviation
            });
    },

    get: (virusId) => {
        return Request.get(`/api/viruses/${virusId}`);
    }

};

export default virusesAPI;
