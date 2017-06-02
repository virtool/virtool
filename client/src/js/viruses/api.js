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
        fetch(`/api/viruses/${virusId}`, {
            method: "GET"
        }).then(resp => resp.json());
    },

    edit: (virusId, update) => {
        fetch(`/api/viruses/${virusId}`, {
            method: "PATCH",
            body: JSON.stringify(update)
        }).then(resp => resp.json());
    },

    remove: virusId => {
        fetch(`/api/viruses/${virusId}`, {
            method: "DELETE"
        }).then(resp => resp.json());
    }

};

export default virusesAPI;
