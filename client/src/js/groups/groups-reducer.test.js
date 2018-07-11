import reducer, {
    initialState as reducerInitialState,
    updateGroup
} from "./reducer";
import {
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../actionTypes";

describe("Groups Reducer", () => {

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

    it("should handle LIST_GROUPS_SUCCEEDED", () => {
        state = {};
        action = {
            type: LIST_GROUPS.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            list: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_GROUP_REQUESTED", () => {
        state = {};
        action = {
            type: CREATE_GROUP.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle REMOVE_GROUP_REQUESTED", () => {
        state = {};
        action = {
            type: REMOVE_GROUP.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle SET_GROUP_PERMISSION_REQUESTED", () => {
        state = {};
        action = {
            type: SET_GROUP_PERMISSION.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_GROUP_SUCCEEDED", () => {
        state = {};
        action = {
            type: CREATE_GROUP.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: false,
            list: [{}]
        };

        expect(result).toEqual(expected);
    });

    it("should handle SET_GROUP_PERMISSION_SUCCEEDED", () => {
        state = {};
        action = {
            type: SET_GROUP_PERMISSION.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: false,
            list: [{}]
        };

        expect(result).toEqual(expected);
    });

    describe("should handle CREATE_GROUP_FAILED", () => {

        it("with 'Group already exists' error", () => {
            state = {};
            action = {
                type: CREATE_GROUP.FAILED,
                message: "Group already exists"
            };
            result = reducer(state, action);
            expected = {
                ...state,
                createError: true,
                pending: false
            };
    
            expect(result).toEqual(expected);
        });

        it("with some other error", () => {
            state = {};
            action = {
                type: CREATE_GROUP.FAILED,
                message: "different error"
            };
            result = reducer(state, action);
            expected = state;
    
            expect(result).toEqual(expected);
        });

    });

    it("should handle REMOVE_GROUP_SUCCEEDED", () => {
        state = {
            list: [
                { id: "group1" },
                { id: "group2" },
                { id: "group3" }
            ]
        };
        action = {
            type: REMOVE_GROUP.SUCCEEDED,
            id: "group3"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            pending: false,
            list: [
                { id: "group1" },
                { id: "group2" }
            ]
        };

        expect(result).toEqual(expected);
    });

    describe("Groups Reducer Helper Functions", () => {

        describe("updateGroup", () => {

            it("should return group list with one permission value of a group updated", () => {
                state = {
                    list: [
                        {
                            id: "tester",
                            permissions: {
                                test_permission: false
                            }
                        },
                        {
                            id: "tester_two",
                            permissions: {
                                test_permission: false
                            }
                        }
                    ]
                };
                const update = {
                    id: "tester",
                    permissions: {
                        test_permission: true
                    }
                };
                result = updateGroup(state, update);
                expected = {
                    ...state,
                    pending: false,
                    list: [
                        {
                            id: "tester",
                            permissions: {
                                test_permission: true
                            }
                        },
                        {
                            id: "tester_two",
                            permissions: {
                                test_permission: false
                            }
                        }
                    ]
                };
            });
        });
    });
});
