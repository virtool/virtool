import Request from "superagent";

const accountAPI = {

    get: () => (
        Request.get("/api/account")
    ),

    getSettings: () => (
        Request.get("/api/account/settings")
    ),

    updateSettings: (update) => (
        Request.patch("/api/account/settings")
            .send(update)
    ),

    changePassword: (oldPassword, newPassword) => (
        Request.put("/api/account/password")
            .send({
                old_password: oldPassword,
                new_password: newPassword
            })
    ),

    getAPIKeys: () => (
        Request.get("/api/account/keys")
    ),

    createAPIKey: (name, permissions) => (
        Request.post("/api/account/keys")
            .send({
                name,
                permissions
            })
    ),

    updateAPIKey: (keyId, permissions) => (
        Request.patch(`/api/account/keys/${keyId}`)
            .send({
                permissions
            })
    ),

    removeAPIKey: (keyId) => (
        Request.delete(`/api/account/keys/${keyId}`)
    ),

    logout: () => (
        Request.get("/api/account/logout")
    )

};

export default accountAPI;
