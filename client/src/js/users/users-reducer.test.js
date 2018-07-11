import reducer, {
    initialState as reducerInitialState
} from "./reducer";
import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";

describe("Users Reducer", () => {

    const initialState = reducerInitialState;
    let state;
    let action;
    let result;
    let expected;

    it("should return the initial state on first pass", () => {
        result = reducer(undefined, {});
        expected = initialState;

        expect(result).toEqual(expected);
    });

    it("should return the given state on other action types", () => {
        action = {
            type: "UNHANDLED_ACTION"
        };
        result = reducer(initialState, action);
        expected = initialState;

        expect(result).toEqual(expected);
    });

    it("should handle LIST_USERS_SUCCEEDED", () => {
        state = {};
        action = {
            type: LIST_USERS.SUCCEEDED,
            data: [
                { id: "admin" },
                { id: "user" }
            ]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: action.data,
            isLoading: false,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle FILTER_USERS_SUCCEEDED", () => {
        state = {};
        action = {
            type: FILTER_USERS,
            term: "search_term"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_SUCCEEDED", () => {
        state = {
            list: {
                documents: [
                    { id: "admin" },
                    { id: "user" }
                ]
            }
        };
        action = {
            type: CREATE_USER.SUCCEEDED,
            data: {
                id: "new_user"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: {
                documents: [
                    { id: "admin" },
                    { id: "user" },
                    { id: "new_user" }
                ]
            }
        };

        expect(result).toEqual(expected);
    });

    it("should handle EDIT_USER_SUCCEEDED", () => {
        state = {
            detail: {
                id: "user",
                permissions: { testing: false }
            }
        };
        action = {
            type: EDIT_USER.SUCCEEDED,
            data: {
                id: "user",
                permissions: { testing: true }
            }
        };
        result = reducer(state, action);
        expected = {
            detail: {
                id: "user",
                permissions: { testing: true }
            }
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_REQUESTED", () => {
        state = {};
        action = {
            type: CREATE_USER.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            createPending: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_FAILED", () => {
        state = {};
        action = {
            type: CREATE_USER.FAILED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            createPending: false
        };

        expect(result).toEqual(expected);
    });

    describe("should handle EDIT_USER_REQUESTED", () => {

        it("when handling password update, return [passwordPending=true]", () => {
            state = {
                password: "old_password",
                list: []
            };
            action = {
                type: EDIT_USER.REQUESTED,
                update: {
                    password: "new_password"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                passwordPending: true
            };

            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = {
                type: EDIT_USER.REQUESTED,
                update: {}
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

    });

});
