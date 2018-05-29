import Request from "superagent";

export const list = () => (
    Request.get("/api/refs")
        .query({ per_page: 100 })
);

export const get = ({ referenceId }) => (
    Request.get(`/api/refs/${referenceId}`)
);

export const create = ({ name, description, dataType, organism, isPublic }) => (
    Request.post("/api/refs")
        .send({
            name,
            description,
            data_type: dataType,
            organism,
            public: isPublic
        })
);

export const edit = ({ referenceId, update }) => (
    Request.patch(`/api/refs/${referenceId}`)
        .send(update)
);

export const importReference = ({ name, description, dataType, organism, isPublic, fileId }) => (
    Request.post("/api/refs")
        .send({
            name,
            description,
            data_type: dataType,
            organism,
            public: isPublic,
            import_from: fileId
        })
);

export const cloneReference = ({ name, description, dataType, organism, isPublic, refId }) => (
    Request.post("/api/refs")
        .send({
            name,
            description,
            data_type: dataType,
            organism,
            public: isPublic,
            clone_from: refId
        })
);

export const remoteReference = ({ name, remote_from }) => (
    Request.post("/api/refs")
        .send({ name, remote_from })
);

export const remove = ({ refId }) => (
    Request.delete(`/api/refs/${refId}`)
);

export const addUser = ({ refId, user }) => (
    Request.post(`/api/refs/${refId}/users`)
        .send({ user })
);

export const editUser = ({ refId, userId, update }) => (
    Request.patch(`/api/refs/${refId}/users/${userId}`)
        .send(update)
);

export const removeUser = ({ refId, userId }) => (
    Request.delete(`/api/refs/${refId}/users/${userId}`)
);

export const addGroup = ({ refId, group }) => (
    Request.post(`/api/refs/${refId}/groups`)
        .send({ group })
);

export const editGroup = ({ refId, groupId, update }) => (
    Request.patch(`/api/refs/${refId}/groups/${groupId}`)
        .send(update)
);

export const removeGroup = ({ refId, groupId }) => (
    Request.delete(`/api/refs/${refId}/groups/${groupId}`)
);
