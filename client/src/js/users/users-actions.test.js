import {
    listUsers,
    filterUsers,
    createUser,
    editUser,
    addUserToGroup,
    removeUserFromGroup
} from "./actions";
import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP, EDIT_USER
} from "../actionTypes";

describe("Users Action Creators:", () => {

    it("listUsers: returns action to list all users", () => {
        const result = listUsers();
        const expected = {
            type: "LIST_USERS_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("filterUsers: returns action to filter users by term", () => {
        const term = "searchterm";
        const result = filterUsers(term);
        const expected = {
            type: "FILTER_USERS_REQUESTED",
            term
        };

        expect(result).toEqual(expected);
    });

    it("createUser: returns action to create a user", () => {
        const data = {};
        const result = createUser(data);
        const expected = {
            type: "CREATE_USER_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("editUser: returns action to modify a user", () => {
        const userId = "testid";
        const update = {};
        const result = editUser(userId, update);
        const expected = {
            type: "EDIT_USER_REQUESTED",
            userId,
            update
        };

        expect(result).toEqual(expected);
    });

});
