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

    get: () => (
        Request.get("/api/settings")
    ),

    update: (update) => (
        Request.patch("/api/settings", update)
    )

};

export default settingsAPI;
