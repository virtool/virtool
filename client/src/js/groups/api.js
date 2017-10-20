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
    },

    create: (groupId) => {
        return Request.post("/api/groups")
            .send({group_id: groupId});
    },

    setPermission: (groupId, permission, value) => {
        let update = {};
        update[permission] = value;

        return Request.patch(`/api/groups/${groupId}`)
            .send(update);
    },

    remove: (groupId) => {
        return Request.delete(`/api/groups/${groupId}`);
    }

};

export default groupsAPI;
