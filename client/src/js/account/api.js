/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const accountAPI = {

    get: () => {
        return Request.get("/api/account")
    },

    getSettings: () => {
        return Request.get("/api/account/settings");
    },

    updateSettings: (update) => {
        return Request.patch("/api/account/settings")
            .send(update);
    },

    logout: () => {
        return Request.get("/api/account/logout");
    }
};

export default accountAPI;
