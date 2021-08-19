import {
    WS_INSERT_REFERENCE,
    WS_UPDATE_REFERENCE,
    WS_REMOVE_REFERENCE,
    GET_REFERENCE,
    EDIT_REFERENCE,
    UPLOAD,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE,
    ADD_REFERENCE_USER,
    EDIT_REFERENCE_USER,
    REMOVE_REFERENCE_USER,
    ADD_REFERENCE_GROUP,
    EDIT_REFERENCE_GROUP,
    REMOVE_REFERENCE_GROUP,
    FIND_REFERENCES
} from "../../app/actionTypes";
import reducer, { initialState } from "../reducer";

describe("References Reducer", () => {
    it("should return the initial state on first pass", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual(initialState);
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const result = reducer(initialState, action);
        expect(result).toEqual(initialState);
    });

    describe("should handle WS_INSERT_REFERENCE", () => {
        it("returns state if documents not yet fetched", () => {
            const state = { documents: null };
            const action = { type: WS_INSERT_REFERENCE, data: { id: "foo" } };
            const result = reducer(state, action);
            expect(result).toEqual({ documents: [{ id: "foo" }] });
        });

        it("inserts entry into list otherwise", () => {
            const state = {
                ...initialState,
                documents: [],
                page: 1,
                fetched: true
            };
            const action = {
                type: WS_INSERT_REFERENCE,
                data: { id: "123abc", name: "testReference" }
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                ...state,
                documents: [{ ...action.data }]
            });
        });
    });

    it("should handle WS_UPDATE_REFERENCE", () => {
        const state = { documents: [{ id: "123abc", name: "testReference" }] };
        const action = {
            type: WS_UPDATE_REFERENCE,
            data: { id: "123abc", name: "testReference-edited" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...state,
            documents: [{ id: "123abc", name: "testReference-edited" }]
        });
    });

    it("should handle WS_REMOVE_REFERENCE", () => {
        const state = {
            documents: [{ id: "123abc", name: "testReference" }]
        };
        const action = {
            type: WS_REMOVE_REFERENCE,
            data: ["123abc"]
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            documents: []
        });
    });

    it("should handle FIND_REFERENCES_REQUESTED", () => {
        const term = "foo";
        const action = {
            type: FIND_REFERENCES.REQUESTED,
            term: "foo"
        };
        const result = reducer({}, action);
        expect(result).toEqual({ term });
    });

    it("should handle FIND_REFERENCES_SUCCEEDED", () => {
        const state = { documents: null };
        const action = {
            type: FIND_REFERENCES.SUCCEEDED,
            data: { documents: [], page: 3, page_count: 5 }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            ...action.data
        });
    });

    it("should handle GET_REFERENCE_REQUESTED", () => {
        const action = { type: GET_REFERENCE.REQUESTED };
        const result = reducer({}, action);
        expect(result).toEqual({ detail: null });
    });

    it("should handle GET_REFERENCE_SUCCEEDED", () => {
        const action = { type: GET_REFERENCE.SUCCEEDED, data: { foo: "bar" } };
        const result = reducer({}, action);
        expect(result).toEqual({ detail: { foo: "bar" } });
    });

    it("should handle EDIT_REFERENCE_SUCCEEDED", () => {
        const state = { detail: { foo: "bar" } };
        const action = {
            type: EDIT_REFERENCE.SUCCEEDED,
            data: { foo: "baz" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: { foo: "baz" } });
    });

    it("should handle UPLOAD_SUCCEEDED", () => {
        const action = { type: UPLOAD.SUCCEEDED, data: { foo: "bar" } };
        const result = reducer({}, action);
        expect(result).toEqual({
            importFile: {
                foo: "bar"
            },
            importUploadId: null,
            importUploadName: null,
            importUploadProgress: 0
        });
    });

    it("should handle CHECK_REMOTE_UPDATES_REQUESTED", () => {
        const action = { type: CHECK_REMOTE_UPDATES.REQUESTED };
        const result = reducer({}, action);
        expect(result).toEqual({ checking: true });
    });

    it("should handle CHECK_REMOTE_UPDATES_FAILED", () => {
        const action = { type: CHECK_REMOTE_UPDATES.FAILED };
        const result = reducer({}, action);
        expect(result).toEqual({ checking: false });
    });

    it("should handle CHECK_REMOTE_UPDATES_SUCCEEDED", () => {
        const state = { checking: true };
        const action = {
            type: CHECK_REMOTE_UPDATES.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            checking: false,
            detail: {
                release: { foo: "bar" }
            }
        });
    });

    it("should handle UPDATE_REMOTE_REFERENCE_SUCCEEDED", () => {
        const state = { detail: {} };
        const action = {
            type: UPDATE_REMOTE_REFERENCE.SUCCEEDED,
            data: { foo: "bar" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: { release: { foo: "bar" } } });
    });

    it("should handle ADD_REFERENCE_USER_SUCCEEDED", () => {
        const state = { detail: { users: [] } };
        const action = {
            type: ADD_REFERENCE_USER.SUCCEEDED,
            data: { id: "test-user" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ detail: { users: [{ id: "test-user" }] } });
    });

    it("should handle EDIT_REFERENCE_USER_SUCCEEDED", () => {
        const state = { detail: { users: [{ id: "test-user", foo: "bar" }] } };
        const action = {
            type: EDIT_REFERENCE_USER.SUCCEEDED,
            data: { id: "test-user", foo: "baz" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            detail: { users: [{ id: "test-user", foo: "baz" }] }
        });
    });

    describe("should handle REMOVE_REFERENCE_USER_REQUESTED", () => {
        it("when store and action ref ids match", () => {
            const state = { detail: { id: "foo" }, pendingRemoveUsers: ["fred"] };
            const action = {
                type: REMOVE_REFERENCE_USER.REQUESTED,
                refId: "foo",
                userId: "bob"
            };
            const result = reducer(state, action);
            expect(result).toEqual({
                detail: { id: "foo" },
                pendingRemoveUsers: ["fred", "bob"]
            });
        });

        it("when store and action ref ids don't match", () => {
            const state = { detail: { id: "foo" }, pendingRemoveUsers: ["fred"] };
            const action = {
                type: REMOVE_REFERENCE_USER.REQUESTED,
                refId: "bar",
                userId: "bob"
            };
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("should handle REMOVE_REFERENCE_USER_SUCCEEDED", () => {
        let action;
        let state;

        beforeEach(() => {
            action = {
                type: REMOVE_REFERENCE_USER.SUCCEEDED,
                context: {
                    refId: "foo",
                    userId: "bar"
                }
            };
            state = {
                detail: {
                    id: "foo",
                    users: [{ id: "bar" }, { id: "bad" }]
                },
                pendingRemoveUsers: ["bar", "baz"]
            };
        });

        it("when store and action ref ids match", () => {
            const result = reducer(state, action);
            expect(result).toEqual({
                detail: { ...state.detail, users: [{ id: "bad" }] },
                pendingRemoveUsers: ["baz"]
            });
        });

        it("when store and action ref ids don't match", () => {
            action.context.refId = "boo";
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    it("should handle ADD_REFERENCE_GROUP_SUCCEEDED", () => {
        const state = { detail: { groups: [] } };
        const action = {
            type: ADD_REFERENCE_GROUP.SUCCEEDED,
            data: { id: "test-group" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            detail: { groups: [{ id: "test-group" }] }
        });
    });

    it("should handle EDIT_REFERENCE_GROUP_SUCCEEDED", () => {
        const state = {
            detail: {
                groups: [{ id: "foo", foo: "bar" }]
            }
        };
        const action = {
            type: EDIT_REFERENCE_GROUP.SUCCEEDED,
            data: { id: "foo", foo: "baz" }
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            detail: {
                groups: [{ id: "foo", foo: "baz" }]
            }
        });
    });

    describe("should handle REMOVE_REFERENCE_GROUP_REQUESTED", () => {
        let action;
        let state;

        beforeEach(() => {
            action = {
                type: REMOVE_REFERENCE_GROUP.REQUESTED,
                refId: "foo",
                groupId: "baz"
            };
            state = {
                detail: { id: "foo" },
                pendingRemoveGroups: ["bar"]
            };
        });

        it("when store and action ref ids match", () => {
            const result = reducer(state, action);
            expect(result).toEqual({
                detail: { id: "foo" },
                pendingRemoveGroups: ["bar", "baz"]
            });
        });

        it("when store and action ref ids don't match", () => {
            action.refId = "bar";
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });

    describe("should handle REMOVE_REFERENCE_GROUP_SUCCEEDED", () => {
        let action;
        let state;

        beforeEach(() => {
            action = {
                type: REMOVE_REFERENCE_GROUP.SUCCEEDED,
                context: {
                    refId: "foobar",
                    groupId: "bar"
                }
            };

            state = {
                detail: {
                    id: "foobar",
                    groups: [{ id: "foo" }, { id: "bar" }]
                },
                pendingRemoveGroups: ["bar", "baz"]
            };
        });

        it("when store and action ref ids match", () => {
            const result = reducer(state, action);
            expect(result).toEqual({
                detail: {
                    id: "foobar",
                    groups: [{ id: "foo" }]
                },
                pendingRemoveGroups: ["baz"]
            });
        });

        it("when store and action ref ids don't match", () => {
            action.context.refId = "bid";
            const result = reducer(state, action);
            expect(result).toEqual(state);
        });
    });
});
