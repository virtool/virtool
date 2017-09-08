/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const updatesAPI = {

    getSoftware: () => {
        return Request.get("/api/updates/software");
    },

    getDatabase: () => {
        return Request.get("/api/updates/database");
    },

    installSoftwareUpdates: () => {
        return Request.patch("/api/updates/software", {});
    }
};

export default updatesAPI;
