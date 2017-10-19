/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const groupsAPI = {

    list: () => {
        return Request.get("/api/groups");
    }

};

export default groupsAPI;
