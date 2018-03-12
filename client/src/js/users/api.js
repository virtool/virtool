import Request from "superagent";

export const list = () => (
    Request.get("/api/users")
);

export const get = (userId) => (
    Request.get(`/api/users/${userId}`)
);

export const create = ({ userId, password, forceReset }) => (
    Request.post("/api/users")
        .send({
            user_id: userId,
            password,
            force_reset: forceReset
        })
);

export const edit = ({ userId, update }) => (
    Request.patch(`/api/users/${userId}`)
        .send(update)
);

export const addUserToGroup = ({ userId, groupId }) => (
    Request.post(`/api/users/${userId}/groups`, {
        group_id: groupId
    })
);

export const removeUserFromGroup = ({ userId, groupId }) => (
    Request.delete(`/api/users/${userId}/groups/${groupId}`)
);
