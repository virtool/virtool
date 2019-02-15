import {
    WS_INSERT_GROUP,
    WS_UPDATE_GROUP,
    WS_REMOVE_GROUP,
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState, updateGroup, insertGroup } from "../reducer";

describe("Groups Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(reducerInitialState);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer(reducerInitialState, action);
        expect(result).toEqual(reducerInitialState);
    });

    describe("should handle WS_INSERT_GROUP", () => {
        it("if documents are not yet fetched, return state", () => {
            const state = { documents: null };
            const action = { type: WS_INSERT_GROUP, data: { id: "foo" } };
            const result = reducer(state, action);
            expect(result).toEqual({
                documents: [{ id: "foo" }]
            });
        });

        it("otherwise insert entry into list", () => {
            const state = { documents: [] };
            const action = {
                type: WS_INSERT_GROUP,
                data: { id: "test" }
            };
            const result = reducer(state, action);
            expect(result).toEqual({ documents: [{ id: "test" }] });
        });
    });

    it("should handle WS_UPDATE_GROUP", () => {
        const state = { documents: [{ id: "test", foo: "bar" }] };
        const action = {
            type: WS_UPDATE_GROUP,
            data: { id: "test", foo: "baz" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, documents: [{ id: "test", foo: "baz" }] });
    });

    it("should handle WS_REMOVE_GROUP", () => {
        const state = { documents: [{ id: "foo" }, { id: "bar" }], activeId: "bar" };
        const action = { type: WS_REMOVE_GROUP, data: ["bar"] };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, documents: [{ id: "foo" }], activeId: "foo" });
    });

    it("should handle LIST_GROUPS_SUCCEEDED", () => {
        const state = { documents: null };
        const data = [{ id: "foo" }, { id: "bar" }];
        const action = {
            type: LIST_GROUPS.SUCCEEDED,
            data
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: data,
            activeId: "foo"
        });
    });

    it("should handle CREATE_GROUP_REQUESTED", () => {
        const state = {};
        const action = {
            type: CREATE_GROUP.REQUESTED
        };
        const result = reducer(state, action);
        expect(result).toEqual({ ...state, pending: true });
    });

    it("should handle REMOVE_GROUP_REQUESTED", () => {
        const action = {
            type: REMOVE_GROUP.REQUESTED
        };
        const result = reducer({}, action);
        expect(result).toEqual({ pending: true });
    });

    it("should handle SET_GROUP_PERMISSION_REQUESTED", () => {
        const action = {
            type: SET_GROUP_PERMISSION.REQUESTED
        };
        const result = reducer({}, action);
        expect(result).toEqual({ pending: true });
    });

    it("should handle CREATE_GROUP_SUCCEEDED", () => {
        const id = "foo";
        const action = { type: CREATE_GROUP.SUCCEEDED, data: { id } };
        const result = reducer({}, action);
        expect(result).toEqual({ pending: false, activeId: id });
    });

    it("should handle REMOVE_GROUP_SUCCEEDED", () => {
        const action = { type: REMOVE_GROUP.SUCCEEDED };
        const result = reducer({}, action);
        expect(result).toEqual({ pending: false, activeId: "" });
    });

    it("should handle SET_GROUP_PERMISSION_SUCCEEDED", () => {
        const action = { type: SET_GROUP_PERMISSION.SUCCEEDED };
        const result = reducer({}, action);
        expect(result).toEqual({ pending: false });
    });

    describe("should handle CREATE_GROUP_FAILED", () => {
        it("with 'Group already exists' error", () => {
            const action = {
                type: CREATE_GROUP.FAILED,
                message: "Group already exists"
            };
            const result = reducer({}, action);
            expect(result).toEqual({
                createError: true,
                pending: false
            });
        });

        it("with some other error", () => {
            const action = {
                type: CREATE_GROUP.FAILED,
                message: "different error"
            };
            const result = reducer({}, action);
            expect(result).toEqual({});
        });
    });

    describe("Groups Reducer Helper Functions", () => {
        it("updateGroup: should return group list with one permission value of a group updated", () => {
            const state = {
                documents: [
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
            const result = updateGroup(state, update);
            expect(result).toEqual({
                ...state,
                pending: false,
                documents: [
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
            });
        });

        it("insertGroup: adds new entry to current list and sorts by id", () => {
            const list = [{ id: "a" }, { id: "d" }, { id: "g" }];
            const entry = { id: "c" };
            const result = insertGroup(list, entry);
            expect(result).toEqual([{ id: "a" }, { id: "c" }, { id: "d" }, { id: "g" }]);
        });
    });
});
