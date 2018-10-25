import {
    WS_INSERT_USER,
    WS_UPDATE_USER,
    WS_REMOVE_USER,
    LIST_USERS,
    FILTER_USERS,
    GET_USER,
    CREATE_USER,
    EDIT_USER
} from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

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

    describe("should handle WS_INSERT_USER", () => {
        it("return state if list is not yet fetched", () => {
            state = { fetched: false };
            action = { type: WS_INSERT_USER };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("insert entry into current list", () => {
            state = {
                ...initialState,
                list: {
                    documents: [],
                    page: 1,
                    per_page: 25
                },
                fetched: true
            };
            action = {
                type: WS_INSERT_USER,
                data: {
                    administrator: false,
                    force_reset: false,
                    groups: [],
                    id: "newUser",
                    identicon: "123newHash",
                    last_password_change: "2018-01-01T00:00:00.000000Z",
                    permissions: {},
                    primary_group: ""
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                list: {
                    ...state.list,
                    documents: [{ ...action.data }]
                }
            };
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_UPDATE_USER", () => {
        it("returns state if list is null", () => {
            state = { list: null };
            action = { type: WS_UPDATE_USER };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("update entry if present in list", () => {
            state = {
                ...initialState,
                list: {
                    ...state.list,
                    documents: [
                        {
                            administrator: false,
                            force_reset: false,
                            groups: [],
                            id: "newUser",
                            identicon: "123newHash",
                            last_password_change: "2018-01-01T00:00:00.000000Z",
                            permissions: {},
                            primary_group: ""
                        }
                    ]
                },
                fetched: true
            };
            action = {
                type: WS_UPDATE_USER,
                data: {
                    administrator: true,
                    force_reset: false,
                    groups: [],
                    id: "newUser",
                    identicon: "123newHash",
                    last_password_change: "2018-01-01T00:00:00.000000Z",
                    permissions: {},
                    primary_group: ""
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                list: {
                    ...state.list,
                    documents: [{ ...action.data }]
                }
            };

            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_REMOVE_USER", () => {
        it("returns state if list is null", () => {
            state = { list: null };
            action = { type: WS_REMOVE_USER };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("remove entry if present in list", () => {
            state = {
                ...initialState,
                list: {
                    documents: [{ id: "testUser" }]
                },
                fetched: true
            };
            action = {
                type: WS_REMOVE_USER,
                data: ["testUser"]
            };
            result = reducer(state, action);
            expected = {
                ...state,
                list: {
                    ...state.list,
                    documents: []
                },
                refetchPage: false
            };

            expect(result).toEqual(expected);
        });
    });

    it("should handle LIST_USERS_REQUESTED", () => {
        state = initialState;
        action = {
            type: LIST_USERS.REQUESTED,
            page: 123
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: true,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle LIST_USERS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: LIST_USERS.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 1,
                per_page: 25,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: { ...action.data },
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);

        state = { list: { documents: [{ id: "test" }], page: 1 } };
        result = reducer(state, action);
        expected = {
            list: { ...action.data },
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_USERS_FAILED", () => {
        state = initialState;
        action = {
            type: LIST_USERS.FAILED,
            message: "not found",
            status: 404
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: false,
            errorLoad: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle FILTER_USERS_REQUESTED", () => {
        state = initialState;
        action = {
            type: FILTER_USERS.REQUESTED,
            term: "test"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            filter: action.term
        };

        expect(result).toEqual(expected);
    });

    it("should handle FILTER_USERS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: FILTER_USERS.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 1,
                per_page: 25,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_USER_REQUESTED", () => {
        state = initialState;
        action = {
            type: GET_USER.REQUESTED,
            userId: "testUser"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_USER_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: GET_USER.SUCCEEDED,
            data: {
                administrator: true,
                force_reset: false,
                groups: [],
                id: "testUser",
                identicon: "123hash",
                last_password_change: "2018-01-01T00:00:00.000000Z",
                permissions: {},
                primary_group: ""
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_REQUESTED", () => {
        state = initialState;
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

    it("should handle CREATE_USER_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: CREATE_USER.SUCCEEDED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            createPending: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_USER_FAILED", () => {
        state = initialState;
        action = {
            type: CREATE_USER.FAILED,
            message: "user already exists",
            status: 400
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
            state = initialState;
            action = {
                type: EDIT_USER.REQUESTED,
                userId: "testUser",
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
            state = initialState;
            action = {
                type: EDIT_USER.REQUESTED,
                update: {
                    other: "not_password"
                }
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });
    });

    it("should handle EDIT_USER_SUCCEEDED", () => {
        state = {
            ...initialState,
            detail: {
                id: "testUser",
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
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });
});
