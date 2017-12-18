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

    list: () => (
        Request.get("/api/users")
    ),

    get: (userId) => (
        Request.get(`/api/users/${userId}`)
    ),

    create: (userId, password, forceReset) => (
        Request.post("/api/users")
            .send({
                user_id: userId,
                password,
                force_reset: forceReset
            })
    ),

    setPassword: (userId, password) => (
        Request.put(`/api/users/${userId}/password`)
            .send({password})
    ),

    setForceReset: (userId, enabled) => (
        Request.put(`/api/users/${userId}/reset`)
            .send({force_reset: enabled})
    ),

    setPrimaryGroup: (userId, primaryGroup) => (
        Request.put(`/api/users/${userId}/primary`)
            .send({primary_group: primaryGroup})
    ),

    addUserToGroup: (userId, groupId) => (
        Request.post(`/api/users/${userId}/groups`, {
            group_id: groupId
        })
    ),

    removeUserFromGroup: (userId, groupId) => (
        Request.delete(`/api/users/${userId}/groups/${groupId}`)
    )

};

export default usersAPI;
