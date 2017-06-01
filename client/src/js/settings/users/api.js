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

    setPassword: (userId, password) => {
        return Request.put(`/api/users/${userId}/password`)
            .send({password: password});
    },

    setForceReset: (userId, enabled) => {
        return Request.put(`/api/users/${userId}/reset`)
            .send({force_reset: enabled});
    },

    setPrimaryGroup: (userId, primaryGroup) => {
        return Request.put(`/api/users/${userId}/primary`)
            .send({primary_group: primaryGroup});
    }

};

export default usersAPI;
