import Request from "superagent";

export const find = ({ term, page }) => Request.get("/api/refs").query({ find: term, page });

export const get = ({ refId }) => Request.get(`/api/refs/${refId}`);

export const create = ({ name, description, dataType, organism }) =>
    Request.post("/api/refs").send({
        name,
        description,
        data_type: dataType,
        organism
    });

export const edit = ({ refId, update }) => Request.patch(`/api/refs/${refId}`).send(update);

export const importReference = ({ name, description, dataType, organism, fileId }) =>
    Request.post("/api/refs").send({
        name,
        description,
        data_type: dataType,
        organism,
        import_from: fileId
    });

export const cloneReference = ({ name, description, dataType, organism, refId }) =>
    Request.post("/api/refs").send({
        name,
        description,
        data_type: dataType,
        organism,
        clone_from: refId
    });

export const remoteReference = ({ remote_from }) => Request.post("/api/refs").send({ remote_from });

export const remove = ({ refId }) => Request.delete(`/api/refs/${refId}`);

export const addUser = ({ refId, user }) => Request.post(`/api/refs/${refId}/users`).send({ user_id: user });

export const editUser = ({ refId, userId, update }) => Request.patch(`/api/refs/${refId}/users/${userId}`).send(update);

export const removeUser = ({ refId, userId }) => Request.delete(`/api/refs/${refId}/users/${userId}`);

export const addGroup = ({ refId, group }) => Request.post(`/api/refs/${refId}/groups`).send({ group_id: group });

export const editGroup = ({ refId, groupId, update }) =>
    Request.patch(`/api/refs/${refId}/groups/${groupId}`).send(update);

export const removeGroup = ({ refId, groupId }) => Request.delete(`/api/refs/${refId}/groups/${groupId}`);

export const checkUpdates = ({ refId }) => Request.get(`/api/refs/${refId}/release`);

export const updateRemote = ({ refId }) => Request.post(`/api/refs/${refId}/updates`).send({});
