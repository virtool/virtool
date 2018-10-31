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
    WS_INSERT_OTU,
    WS_REMOVE_OTU
} from "../actionTypes";
import reducer, {
    initialState as reducerInitialState,
    checkHasOfficialRemote,
    removeMember
} from "./reducer";

describe("References Reducer", () => {
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

    describe("should handle WS_INSERT_REFERENCE", () => {
        it("returns state if documents not yet fetched", () => {
            state = { fetched: false };
            action = { type: WS_INSERT_REFERENCE };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("inserts entry into list otherwise", () => {
            state = {
                ...initialState,
                documents: [],
                page: 1,
                fetched: true,
                total_count: 0
            };
            action = {
                type: WS_INSERT_REFERENCE,
                data: { id: "123abc", name: "testReference" }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                installOfficial: false,
                documents: [{ ...action.data }],
                total_count: 1
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_REFERENCE", () => {
        state = { documents: [{ id: "123abc", name: "testReference" }] };
        action = {
            type: WS_UPDATE_REFERENCE,
            data: { id: "123abc", name: "testReference-edited" }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [{ id: "123abc", name: "testReference-edited" }]
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_REFERENCE", () => {
        state = {
            documents: [{ id: "123abc", name: "testReference" }],
            page: 1,
            fetched: true,
            total_count: 1
        };
        action = {
            type: WS_REMOVE_REFERENCE,
            data: ["123abc"]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            installOfficial: false,
            documents: [],
            total_count: 0,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_INSERT_OTU", () => {
        state = { detail: { otu_count: 3 } };
        action = { type: WS_INSERT_OTU };
        result = reducer(state, action);
        expected = { detail: { otu_count: 4 } };
        expect(result).toEqual(expected);

        state = { detail: null };
        action = { type: WS_INSERT_OTU };
        result = reducer(state, action);
        expect(result).toEqual(state);
    });

    it("should handle WS_REMOVE_OTU", () => {
        state = { detail: { otu_count: 3 } };
        action = { type: WS_REMOVE_OTU };
        result = reducer(state, action);
        expected = { detail: { otu_count: 2 } };
        expect(result).toEqual(expected);

        state = { detail: null };
        action = { type: WS_REMOVE_OTU };
        result = reducer(state, action);
        expect(result).toEqual(state);
    });

    it("should handle LIST_REFERENCES_REQUESTED", () => {
        state = {};
        action = { type: LIST_REFERENCES.REQUESTED };
        result = reducer(state, action);
        expected = { isLoading: true, errorLoad: false };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_REFERENCES_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: LIST_REFERENCES.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            installOfficial: false,
            documents: [],
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_REFERENCES_FAILED", () => {
        state = {};
        action = { type: LIST_REFERENCES.FAILED };
        result = reducer(state, action);
        expected = { isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle GET_REFERENCE_REQUESTED", () => {
        state = { detail: { foo: "bar" } };
        action = { type: GET_REFERENCE.REQUESTED };
        result = reducer(state, action);
        expected = { detail: null };
        expect(result).toEqual(expected);
    });

    it("should handle GET_REFERENCE_SUCCEEDED", () => {
        state = { detail: null };
        action = { type: GET_REFERENCE.SUCCEEDED, data: { foo: "bar" } };
        result = reducer(state, action);
        expected = { detail: { foo: "bar" } };
        expect(result).toEqual(expected);
    });

    it("should handle EDIT_REFERENCE_SUCCEEDED", () => {
        state = { detail: { foo: "bar" } };
        action = {
            type: EDIT_REFERENCE.SUCCEEDED,
            data: { foo: "baz" }
        };
        result = reducer(state, action);
        expected = { detail: { foo: "baz" } };
        expect(result).toEqual(expected);
    });

    it("should handle UPLOAD_SUCCEEDED", () => {
        state = {};
        action = { type: UPLOAD.SUCCEEDED, data: { foo: "bar" } };
        result = reducer(state, action);
        expected = { importData: { foo: "bar" } };
        expect(result).toEqual(expected);
    });

    it("should handle CHECK_REMOTE_UPDATES_REQUESTED", () => {
        state = {};
        action = { type: CHECK_REMOTE_UPDATES.REQUESTED };
        result = reducer(state, action);
        expected = { detail: { checkPending: true } };
        expect(result).toEqual(expected);
    });

    it("should handle CHECK_REMOTE_UPDATES_FAILED", () => {
        state = { detail: { checkPending: true } };
        action = { type: CHECK_REMOTE_UPDATES.FAILED };
        result = reducer(state, action);
        expected = { detail: { checkPending: false } };
        expect(result).toEqual(expected);
    });

    it("should handle CHECK_REMOTE_UPDATES_SUCCEEDED", () => {
        state = { detail: { checkPending: true } };
        action = {
            type: CHECK_REMOTE_UPDATES.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = {
            detail: {
                checkPending: false,
                release: { foo: "bar" }
            }
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_REMOTE_REFERENCE_SUCCEEDED", () => {
        state = { detail: {} };
        action = {
            type: UPDATE_REMOTE_REFERENCE.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = { detail: { release: { foo: "bar" } } };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_REFERENCES_REQUESTED", () => {
        state = { filter: "" };
        action = {
            type: FILTER_REFERENCES.REQUESTED,
            term: "search"
        };
        result = reducer(state, action);
        expected = { filter: "search" };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_REFERENCES_SUCCEEDED", () => {
        state = { documents: null };
        action = {
            type: FILTER_REFERENCES.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = { documents: [] };
        expect(result).toEqual(expected);
    });

    it("should handle ADD_REFERENCE_USER_SUCCEEDED", () => {
        state = { detail: { users: [] } };
        action = {
            type: ADD_REFERENCE_USER.SUCCEEDED,
            data: { id: "test-user" }
        };
        result = reducer(state, action);
        expected = { detail: { users: [{ id: "test-user" }] } };
        expect(result).toEqual(expected);
    });

    it("should handle EDIT_REFERENCE_USER_SUCCEEDED", () => {
        state = { detail: { users: [{ id: "test-user", foo: "bar" }] } };
        action = {
            type: EDIT_REFERENCE_USER.SUCCEEDED,
            data: { id: "test-user", foo: "baz" }
        };
        result = reducer(state, action);
        expected = { detail: { users: [{ id: "test-user", foo: "baz" }] } };
        expect(result).toEqual(expected);
    });

    describe("should handle REMOVE_REFERENCE_USER_REQUESTED", () => {
        it("if store and response data refIds match, append to pending remove list", () => {
            state = { detail: { id: "test-1", pendingUserRemove: [] } };
            action = {
                type: REMOVE_REFERENCE_USER.REQUESTED,
                refId: "test-1",
                userId: "test-user"
            };
            result = reducer(state, action);
            expected = {
                detail: { id: "test-1", pendingUserRemove: ["test-user"] }
            };
            expect(result).toEqual(expected);
        });

        it("else return state", () => {
            state = { detail: { id: "test-1", pendingUserRemove: [] } };
            action = {
                type: REMOVE_REFERENCE_USER.REQUESTED,
                refId: "test-2",
                userId: "test-user"
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    it("should handle REMOVE_REFERENCE_USER_SUCCEEDED", () => {
        state = {
            detail: {
                users: [{ id: "test-user" }],
                pendingUserRemove: ["test-user"]
            }
        };
        action = { type: REMOVE_REFERENCE_USER.SUCCEEDED };
        result = reducer(state, action);
        expected = { detail: { ...state.detail, users: [] } };
        expect(result).toEqual(expected);
    });

    it("should handle ADD_REFERENCE_GROUP_SUCCEEDED", () => {
        state = { detail: { groups: [] } };
        action = {
            type: ADD_REFERENCE_GROUP.SUCCEEDED,
            data: { id: "test-group" }
        };
        result = reducer(state, action);
        expected = {
            detail: { groups: [{ id: "test-group" }] }
        };
        expect(result).toEqual(expected);
    });

    it("should handle EDIT_REFERENCE_GROUP_SUCCEEDED", () => {
        state = {
            detail: {
                groups: [{ id: "test-group", foo: "bar" }]
            }
        };
        action = {
            type: EDIT_REFERENCE_GROUP.SUCCEEDED,
            data: { id: "test-group", foo: "baz" }
        };
        result = reducer(state, action);
        expected = {
            detail: {
                groups: [{ id: "test-group", foo: "baz" }]
            }
        };
        expect(result).toEqual(expected);
    });

    describe("should handle REMOVE_REFERENCE_GROUP_REQUESTED", () => {
        it("if store and response data refIds match, append to pending remove list", () => {
            state = { detail: { id: "test-1", pendingGroupRemove: [] } };
            action = {
                type: REMOVE_REFERENCE_GROUP.REQUESTED,
                refId: "test-1",
                groupId: "test-group"
            };
            result = reducer(state, action);
            expected = {
                detail: { id: "test-1", pendingGroupRemove: ["test-group"] }
            };
            expect(result).toEqual(expected);
        });

        it("else return state", () => {
            state = { detail: { id: "test-1", pendingGroupRemove: [] } };
            action = {
                type: REMOVE_REFERENCE_GROUP.REQUESTED,
                refId: "test-2",
                groupId: "test-group"
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    it("should handle REMOVE_REFERENCE_GROUP_SUCCEEDED", () => {
        state = {
            detail: {
                groups: [{ id: "test-group" }],
                pendingRemove: ["test-group"]
            }
        };
        action = { type: REMOVE_REFERENCE_GROUP.SUCCEEDED };
        result = reducer(state, action);
        expected = { detail: { groups: [], pendingRemove: [] } };
        expect(result).toEqual(expected);
    });

    describe("Helper Functions", () => {
        let list;

        it("checkHasOfficialRemote: checks list for official remote reference presence", () => {
            list = [];
            result = checkHasOfficialRemote(list);
            expect(result).toBe(false);

            list = [{ id: "official" }];
            result = checkHasOfficialRemote(list);
            expect(result).toBe(false);

            list = [
                {
                    id: "official",
                    remotes_from: { errors: [], slug: "virtool/ref-plant-viruses" }
                }
            ];
            result = checkHasOfficialRemote(list);
            expect(result).toBe(true);
        });

        describe("checkRemoveOfficialRemote: ", () => {
            let removedIds;
            let hasOfficial;

            it("if list does not currently contain official remote, return false", () => {
                list = [];
                removedIds = [];
                hasOfficial = false;
                result = checkRemoveOfficialRemote(list, removedIds, hasOfficial);
                expect(result).toBe(false);
            });

            it("list contains official remote and the official remote pending removal, return false", () => {
                list = [
                    {
                        id: "official",
                        remotes_from: { slug: "virtool/ref-plant-viruses" }
                    }
                ];
                removedIds = ["official"];
                hasOfficial = true;
                result = checkRemoveOfficialRemote(list, removedIds, hasOfficial);
                expect(result).toBe(false);
            });

            it("list contains official remote and the official remote not pending removal, return true", () => {
                list = [{ id: "official" }];
                removedIds = ["test"];
                hasOfficial = true;
                result = checkRemoveOfficialRemote(list, removedIds, hasOfficial);
                expect(result).toBe(true);
            });
        });

        it("removeMember: removes oldest member in pending list", () => {
            list = [];
            let pendingRemoves = [];
            result = removeMember(list, pendingRemoves);
            expect(result).toEqual(list);

            list = [{ id: "foo" }];
            pendingRemoves = ["bar"];
            result = removeMember(list, pendingRemoves);
            expect(result).toEqual(list);

            list = [{ id: "foo" }];
            pendingRemoves = ["foo"];
            result = removeMember(list, pendingRemoves);
            expected = [];
            expect(result).toEqual(expected);
        });
    });
});
