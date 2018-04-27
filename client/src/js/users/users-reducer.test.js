import reducer, {
    initialState as reducerInitialState,
    updateUser
} from "./reducer";
import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    EDIT_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
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
            type: "LIST_USERS_SUCCEEDED",
            data: [
                { id: "admin" },
                { id: "user" }
            ]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: action.data,
            activeId: action.data[0].id,
            activeData: action.data[0]
        };

        expect(result).toEqual(expected);
    });

    it("should handle FILTER_USERS", () => {
        state = {};
        action = {
            type: "FILTER_USERS",
            term: "search_term"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            filter: action.term
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_SUCCEEDED", () => {
        state = {
            list: [
                { id: "admin" },
                { id: "user" }
            ]
        };
        action = {
            type: "CREATE_USER_SUCCEEDED",
            data: {
                id: "new_user"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: [
                { id: "admin" },
                { id: "user" },
                { id: "new_user" }
            ]
        };

        expect(result).toEqual(expected);
    });

    it("should handle EDIT_USER_SUCCEEDED", () => {
        state = {
            list: [
                { id: "admin", permissions: { testing: true } },
                { id: "user", permissions: { testing: false } }
            ]
        };
        action = {
            type: "EDIT_USER_SUCCEEDED",
            data: {
                id: "user",
                permissions: { testing: true }
            }
        };
        result = reducer(state, action);
        expected = {
            list: [
                { id: "admin", permissions: { testing: true } },
                { id: "user", permissions: { testing: true } }
            ]
        };

        expect(result).toEqual(expected);
    });

    it("should handle ADD_USER_TO_GROUP_SUCCEEDED", () => {
        state = {
            list: [
                { id: "admin", groups: [] },
                { id: "user", groups: [] }
            ]
        };
        action = {
            type: "ADD_USER_TO_GROUP_SUCCEEDED",
            id: "user",
            data: [ "test_group" ]
        };
        result = reducer(state, action);
        expected = {
            list: [
                { id: "admin", groups: [] },
                { id: "user", groups: [ "test_group" ] }
            ]
        };

        expect(result).toEqual(expected);
    });
    
    it("should handle REMOVE_USER_FROM_GROUP_SUCCEEDED", () => {
        state = {
            list: [
                { id: "admin", groups: [] },
                { id: "user", groups: [ "test_group" ] }
            ]
        };
        action = {
            type: "REMOVE_USER_FROM_GROUP_SUCCEEDED",
            id: "user",
            data: []
        };
        result = reducer(state, action);
        expected = {
            list: [
                { id: "admin", groups: [] },
                { id: "user", groups: [] }
            ]
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_REQUESTED", () => {
        state = {};
        action = {
            type: "CREATE_USER_REQUESTED"
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
            type: "CREATE_USER_FAILED"
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
                type: "EDIT_USER_REQUESTED",
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
                type: "EDIT_USER_REQUESTED",
                update: {}
            }
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

    });

    describe("Users Reducer Helper Functions", () => {

        describe("updateUser", () => {

            it("should update target user in state.list", () => {
                state = {
                    list: [
                        { id: "admin", groups: [ "dev" ], permissions: { testing: true } },
                        { id: "user1", groups: [ "sub" ], permissions: { testing: false }  },
                        { id: "user2", groups: [ "sub" ], permissions: { testing: false }  }
                    ]
                };
                const update = { id: "user2", groups: [ "dev" ], permissions: { testing: true } };
                result = updateUser(state, update);
                expected = {
                    list: [
                        { id: "admin", groups: [ "dev" ], permissions: { testing: true } },
                        { id: "user1", groups: [ "sub" ], permissions: { testing: false }  },
                        { id: "user2", groups: [ "dev" ], permissions: { testing: true } }
                    ] 
                };

                expect(result).toEqual(expected);
            });
        });
    });
});
