import {
    WS_INSERT_USER,
    WS_UPDATE_USER,
    WS_REMOVE_USER,
    GET_USER,
    CREATE_USER,
    EDIT_USER,
    REMOVE_USER,
    FIND_USERS
} from "../../app/actionTypes";
import {
    wsInsertUser,
    wsUpdateUser,
    wsRemoveUser,
    getUser,
    createUser,
    editUser,
    removeUser,
    findUsers
} from "../actions";

describe("Users Action Creators", () => {
    const userId = "bill";

    it("wsInsertUser", () => {
        const data = {};
        const result = wsInsertUser(data);
        expect(result).toEqual({
            type: WS_INSERT_USER,
            data
        });
    });

    it("wsUpdateUser", () => {
        const data = {};
        const result = wsUpdateUser(data);
        expect(result).toEqual({
            type: WS_UPDATE_USER,
            data
        });
    });

    it("wsRemoveUser", () => {
        const data = [];
        const result = wsRemoveUser(data);
        expect(result).toEqual({
            type: WS_REMOVE_USER,
            data
        });
    });

    it("findUsers", () => {
        const term = "foo";
        const page = 5;
        const result = findUsers(term, page);
        expect(result).toEqual({
            type: FIND_USERS.REQUESTED,
            term,
            page
        });
    });

    it("getUser", () => {
        const result = getUser(userId);
        expect(result).toEqual({
            type: GET_USER.REQUESTED,
            userId
        });
    });

    it("createUser", () => {
        const data = {};
        const result = createUser(data);
        expect(result).toEqual({
            type: CREATE_USER.REQUESTED
        });
    });

    it("editUser", () => {
        const update = {};
        const result = editUser(userId, update);
        expect(result).toEqual({
            type: EDIT_USER.REQUESTED,
            userId,
            update
        });
    });

    it("removeUser", () => {
        const result = removeUser(userId);
        expect(result).toEqual({
            type: REMOVE_USER.REQUESTED,
            userId
        });
    });
});
