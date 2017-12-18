import Request from "superagent";

const groupsAPI = {

    list: () => (
        Request.get("/api/groups")
    ),

    create: (groupId) => (
        Request.post("/api/groups")
            .send({group_id: groupId})
    ),

    setPermission: (groupId, permission, value) => {
        const update = {};
        update[permission] = value;

        return Request.patch(`/api/groups/${groupId}`)
            .send(update);
    },

    remove: (groupId) => (
        Request.delete(`/api/groups/${groupId}`)
    )

};

export default groupsAPI;
