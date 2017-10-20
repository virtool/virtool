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

    add: (userId, password, forceReset) => {
        return Request.post("/api/users")
            .send({
                user_id: userId,
                password,
                force_reset: forceReset
            });
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
    },

    addUserToGroup: (userId, groupId) => {
        return Request.post(`/api/users/${userId}/groups`, {
            group_id: groupId
        });
    },

    removeUserFromGroup: (userId, groupId) => {
        return Request.delete(`/api/users/${userId}/groups/${groupId}`);
    }
};

export default usersAPI;
