/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const settingsAPI = {

    get: () => {
        return Request.get("/api/settings");
    },

    update: (update) => {
        return Request.patch("/api/settings", update);
    }

};

export default settingsAPI;
