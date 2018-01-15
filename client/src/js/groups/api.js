import Request from "superagent";

export const list = () => (
    Request.get("/api/groups")
);

export const create = ({ groupId }) => (
    Request.post("/api/groups")
        .send({group_id: groupId})
);

export const setPermission = ({ groupId, permission, value }) => {
    const update = {};
    update[permission] = value;

    return Request.patch(`/api/groups/${groupId}`)
        .send(update);
};

export const remove = ({ groupId }) => (
    Request.delete(`/api/groups/${groupId}`)
);
