import { forEach } from "lodash-es";
import {
    WS_INSERT_OTU,
    WS_UPDATE_OTU,
    WS_REMOVE_OTU,
    WS_UPDATE_STATUS,
    FIND_OTUS,
    GET_OTU,
    EDIT_OTU,
    REMOVE_OTU,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    UPLOAD_IMPORT,
    SELECT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_OTU,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_OTU_MODAL,
    GET_OTU_HISTORY
} from "../actionTypes";
import reducer, { initialState as reducerInitialState, hideOTUModal, getActiveIsolate, receiveOTU } from "./reducer";

describe("OTUs Reducer:", () => {
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
        action = { type: "UNHANDLED_ACTION" };
        result = reducer(initialState, action);
        expected = initialState;
        expect(result).toEqual(expected);
    });

    describe("should handle WS_UPDATE_STATUS", () => {
        it("if status id is 'OTU_import', return importData", () => {
            state = {};
            action = { type: WS_UPDATE_STATUS, data: { id: "OTU_import" } };
            result = reducer(state, action);
            expected = { importData: { id: "OTU_import", inProgress: true } };
            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = { type: WS_UPDATE_STATUS, data: { id: "test" } };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_INSERT_OTU", () => {
        it("if list is not yet fetched or reference ids do not match, return state", () => {
            state = { fetched: false, referenceId: "test" };
            action = {
                type: WS_INSERT_OTU,
                data: { id: "test", reference: { id: "123abc" } }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("othewise insert new entry into list", () => {
            state = {
                fetched: true,
                referenceId: "123abc",
                documents: [],
                page: 0,
                per_page: 3
            };
            action = {
                type: WS_INSERT_OTU,
                data: { id: "test", reference: { id: "123abc" } }
            };
            result = reducer(state, action);
            expected = { ...state, documents: [action.data] };
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_UPDATE_OTU", () => {
        it("if list is not yet fetched or reference ids do not match, return state", () => {
            state = { fetched: false, referenceId: "123abc" };
            action = {
                type: WS_UPDATE_OTU,
                data: { id: "test", reference: { id: "mistmatch" } }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("othewise insert new entry into list", () => {
            state = {
                fetched: true,
                referenceId: "123abc",
                documents: [{ id: "test-otu", foo: "bar", reference: { id: "123abc" } }]
            };
            action = {
                type: WS_UPDATE_OTU,
                data: { id: "test-otu", foo: "baz", reference: { id: "123abc" } }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ id: "test-otu", foo: "baz", reference: { id: "123abc" } }]
            };
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_REMOVE_OTU", () => {
        it("if list is not yet fetched, return state", () => {
            state = { fetched: false };
            action = { type: WS_REMOVE_OTU };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("othewise insert new entry into list", () => {
            state = {
                fetched: true,
                documents: [{ id: "test" }],
                page: 0,
                page_count: 3
            };
            action = {
                type: WS_REMOVE_OTU,
                data: ["test"]
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [],
                refetchPage: true
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle LIST_OTUS_REQUESTED", () => {
        state = {};
        action = { type: LIST_OTUS.REQUESTED, refId: "123abc" };
        result = reducer(state, action);
        expected = { referenceId: "123abc", isLoading: true, errorLoad: false };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_OTUS_SUCCEEDED", () => {
        state = { documents: [], page: 0 };
        action = {
            type: LIST_OTUS.SUCCEEDED,
            data: { documents: [{ id: "test" }], page: 1 }
        };
        result = reducer(state, action);
        expected = {
            ...action.data,
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_OTUS_FAILED", () => {
        state = {};
        action = { type: LIST_OTUS.FAILED };
        result = reducer(state, action);
        expected = { isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_OTUS.SUCCEEDED", () => {
        state = { documents: null };
        action = { type: FIND_OTUS.SUCCEEDED, data: { documents: [] } };
        result = reducer(state, action);
        expected = { documents: [] };
        expect(result).toEqual(expected);
    });

    it("should handle GET_OTU_REQUESTED", () => {
        state = {};
        action = { type: GET_OTU.REQUESTED };
        result = reducer(state, action);
        expected = {
            ...hideOTUModal(state),
            detail: null,
            activeIsolateId: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle REMOVE_OTU_SUCCEEDED", () => {
        state = {};
        action = { type: REMOVE_OTU.SUCCEEDED };
        result = reducer(state, action);
        expected = {
            ...hideOTUModal(state),
            detail: null,
            activeIsolateId: null
        };
        expect(result).toEqual(expected);
    });

    describe("Actions that close all modals: ", () => {
        const actionList = [
            GET_OTU.SUCCEEDED,
            EDIT_OTU.SUCCEEDED,
            EDIT_ISOLATE.SUCCEEDED,
            ADD_SEQUENCE.SUCCEEDED,
            EDIT_SEQUENCE.SUCCEEDED,
            REMOVE_SEQUENCE.SUCCEEDED,
            SET_ISOLATE_AS_DEFAULT.SUCCEEDED,
            ADD_ISOLATE.SUCCEEDED,
            REMOVE_ISOLATE.SUCCEEDED
        ];

        forEach(actionList, actionType => {
            it(`should handle ${actionType}`, () => {
                state = {};
                action = {
                    type: actionType,
                    data: { id: "test-otu", isolates: [] }
                };
                result = reducer(state, action);
                expected = {
                    detail: action.data,
                    ...hideOTUModal(state),
                    activeIsolate: null,
                    activeIsolateId: null
                };
                expect(result).toEqual(expected);
            });
        });
    });

    it("should handle GET_OTU_HISTORY_REQUESTED", () => {
        state = {};
        action = { type: GET_OTU_HISTORY.REQUESTED };
        result = reducer(state, action);
        expected = { detailHistory: null };
        expect(result).toEqual(expected);
    });

    it("should handle GET_OTU_HISTORY_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_OTU_HISTORY.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = { detailHistory: { foo: "bar" } };
        expect(result).toEqual(expected);
    });

    it("should handle REVERT_SUCCEEDED", () => {
        state = {};
        action = {
            type: REVERT.SUCCEEDED,
            data: { isolates: [] },
            history: {}
        };
        result = reducer(state, action);
        expected = {
            detail: { isolates: [] },
            detailHistory: {},
            activeIsolate: null,
            activeIsolateId: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPLOAD_IMPORT.SUCCEEDED", () => {
        state = {};
        action = {
            type: UPLOAD_IMPORT.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = { importData: { foo: "bar", inProgress: false } };
        expect(result).toEqual(expected);
    });

    it("should handle SELECT_ISOLATE", () => {
        state = { detail: { isolates: [{ id: "test-isolate" }] } };
        action = {
            type: SELECT_ISOLATE,
            isolateId: "test-isolate"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            activeIsolate: { id: "test-isolate" },
            activeIsolateId: "test-isolate"
        };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_OTU", () => {
        state = {};
        action = { type: SHOW_EDIT_OTU };
        result = reducer(state, action);
        expected = { edit: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_OTU", () => {
        state = {};
        action = { type: SHOW_REMOVE_OTU };
        result = reducer(state, action);
        expected = { remove: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_ADD_ISOLATE", () => {
        state = {};
        action = { type: SHOW_ADD_ISOLATE };
        result = reducer(state, action);
        expected = { addIsolate: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_ISOLATE", () => {
        state = {};
        action = { type: SHOW_EDIT_ISOLATE };
        result = reducer(state, action);
        expected = { editIsolate: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_ISOLATE", () => {
        state = {};
        action = { type: SHOW_REMOVE_ISOLATE };
        result = reducer(state, action);
        expected = { removeIsolate: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_ADD_SEQUENCE", () => {
        state = {};
        action = { type: SHOW_ADD_SEQUENCE };
        result = reducer(state, action);
        expected = { addSequence: true };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_EDIT_SEQUENCE", () => {
        state = {};
        action = { type: SHOW_EDIT_SEQUENCE, sequenceId: "test-sequence" };
        result = reducer(state, action);
        expected = { editSequence: "test-sequence" };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_SEQUENCE", () => {
        state = {};
        action = { type: SHOW_REMOVE_SEQUENCE, sequenceId: "test-sequence" };
        result = reducer(state, action);
        expected = { removeSequence: "test-sequence" };
        expect(result).toEqual(expected);
    });

    it("should handle HIDE_OTU_MODAL", () => {
        state = {};
        action = { type: HIDE_OTU_MODAL };
        result = reducer(state, action);
        expected = { ...hideOTUModal(state) };
        expect(result).toEqual(expected);
    });

    describe("Helper functions:", () => {
        describe("getActiveIsolate():", () => {
            it("if isolates array is empty, return state with null activeIsolate values", () => {
                state = { detail: { isolates: [] } };
                result = getActiveIsolate(state);
                expected = {
                    ...state,
                    activeIsolate: null,
                    activeIsolateId: null
                };
                expect(result).toEqual(expected);
            });

            it("otherwise get current activeIsolateId that defaults to first isolate", () => {
                state = { detail: { isolates: [{ id: "isolate" }] } };
                result = getActiveIsolate(state);
                expected = {
                    ...state,
                    activeIsolate: { id: "isolate" },
                    activeIsolateId: "isolate"
                };
                expect(result).toEqual(expected);
            });
        });

        it("receiveOTU(): replace state.detail with action data and reformat isolates", () => {
            state = {};
            action = {
                data: {
                    isolates: [{ id: "123abc", sourceType: "isolate", sourceName: "tester" }]
                }
            };
            result = receiveOTU(state, action);
            expected = {
                activeIsolate: {
                    id: "123abc",
                    sourceType: "isolate",
                    sourceName: "tester",
                    name: "Isolate tester"
                },
                activeIsolateId: "123abc",
                detail: {
                    isolates: [{ ...action.data.isolates[0], name: "Isolate tester" }]
                }
            };
            expect(result).toEqual(expected);
        });
    });
});
