import {
    listUsers,
    filterUsers,
    createUser,
    editUser
} from "./actions";
import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";

describe("Users Action Creators:", () => {

    it("listUsers: returns action to list all users", () => {
        const result = listUsers();
        const expected = {
            type: LIST_USERS.REQUESTED
        };

        expect(result).toEqual(expected);
    });

    it("filterUsers: returns action to filter users by term", () => {
        const term = "searchterm";
        const result = filterUsers(term);
        const expected = {
            type: FILTER_USERS,
            term
        };

        expect(result).toEqual(expected);
    });

    it("createUser: returns action to create a user", () => {
        const data = {};
        const result = createUser(data);
        const expected = {
            type: CREATE_USER.REQUESTED
        };

        expect(result).toEqual(expected);
    });

    it("editUser: returns action to modify a user", () => {
        const userId = "testid";
        const update = {};
        const result = editUser(userId, update);
        const expected = {
            type: EDIT_USER.REQUESTED,
            userId,
            update
        };

        expect(result).toEqual(expected);
    });

});
