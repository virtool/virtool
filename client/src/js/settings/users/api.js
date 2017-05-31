/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import Request from "superagent";

const usersAPI = {

    list: () => {
        return Request.get("/api/users");
    },

    get: (userId) => {
        return Request.get(`/api/users/${userId}`);
    },

    setForceReset: (userId, enabled) => {
        return Request.put(`/api/users/${userId}/reset`)
            .send({force_reset: enabled});
    }

};

export default usersAPI;
