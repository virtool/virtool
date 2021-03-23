import {
    ADD_ISOLATE,
    ADD_SEQUENCE,
    CREATE_OTU,
    EDIT_ISOLATE,
    EDIT_OTU,
    EDIT_SEQUENCE,
    FIND_OTUS,
    GET_OTU,
    GET_OTU_HISTORY,
    HIDE_OTU_MODAL,
    REMOVE_ISOLATE,
    REMOVE_OTU,
    REMOVE_SEQUENCE,
    REVERT,
    SELECT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_ISOLATE,
    SHOW_REMOVE_OTU,
    SHOW_REMOVE_SEQUENCE,
    WS_INSERT_OTU,
    WS_REMOVE_OTU,
    WS_UPDATE_OTU
} from "../../app/actionTypes";
import {
    addIsolate,
    addSequence,
    createOTU,
    editIsolate,
    editOTU,
    editSequence,
    findOTUs,
    getOTU,
    getOTUHistory,
    hideOTUModal,
    removeIsolate,
    removeOTU,
    removeSequence,
    revert,
    selectIsolate,
    setIsolateAsDefault,
    showAddIsolate,
    showEditIsolate,
    showEditOTU,
    showRemoveIsolate,
    showRemoveOTU,
    showRemoveSequence,
    wsInsertOTU,
    wsRemoveOTU,
    wsUpdateOTU
} from "../actions";

describe("OTUs Action Creators", () => {
    const otuId = "test-otu";
    const isolateId = "test-isolate";
    const sequenceId = "test-sequence-id";
    const accession = "test-accession";
    const sourceType = "test-source-type";
    const sourceName = "test-source-name";
    const definition = "test-definition";
    const host = "test-host";
    const sequence = "test-sequence";
    const segment = "test-segment";
    const target = "test-target";

    it("wsInsertOTU: returns action to insert OTU entry via websocket", () => {
        const data = { id: "test" };
        const result = wsInsertOTU(data);
        expect(result).toEqual({ type: WS_INSERT_OTU, data });
    });

    it("wsUpdateOTU: returns action to update OTU entry via websocket", () => {
        const data = { id: "test", foo: "bar" };
        const result = wsUpdateOTU(data);
        expect(result).toEqual({ type: WS_UPDATE_OTU, data });
    });

    it("wsRemoveOTU: returns action to remove OTU entry via websocket", () => {
        const data = ["test"];
        const result = wsRemoveOTU(data);
        expect(result).toEqual({ type: WS_REMOVE_OTU, data });
    });

    it("findOTUs: returns action to list specific page of otu documents", () => {
        const refId = "123abc";
        const term = "foo";
        const verified = true;
        const page = 2;
        const result = findOTUs(refId, term, verified, page);
        expect(result).toEqual({ type: FIND_OTUS.REQUESTED, refId, term, verified, page });
    });

    it("getOTU: returns action to retrieve a specific otu", () => {
        const result = getOTU(otuId);
        expect(result).toEqual({ type: GET_OTU.REQUESTED, otuId });
    });

    it("getOTUHistory: returns action to retrieve change history of specific otu", () => {
        const result = getOTUHistory(otuId);
        expect(result).toEqual({ type: GET_OTU_HISTORY.REQUESTED, otuId });
    });

    it("createOTU: returns action to create a new otu", () => {
        const refId = "123abc";
        const name = "new otu";
        const abbreviation = "NEW";
        const result = createOTU(refId, name, abbreviation);
        expect(result).toEqual({ type: CREATE_OTU.REQUESTED, refId, name, abbreviation });
    });

    it("editOTU: return action to edit a specific otu", () => {
        const name = "target-otu";
        const abbreviation = "OLD";
        const schema = [];
        const result = editOTU(otuId, name, abbreviation, schema);
        expect(result).toEqual({ type: EDIT_OTU.REQUESTED, otuId, name, abbreviation, schema });
    });

    it("removeOTU: returns action to delete specific otu", () => {
        const refId = "123abc";
        const history = {};
        const result = removeOTU(refId, otuId, history);
        expect(result).toEqual({ type: REMOVE_OTU.REQUESTED, refId, otuId, history });
    });

    it("addIsolate: returns action to add an isolate to an otu", () => {
        const result = addIsolate(otuId, sourceType, sourceName);
        expect(result).toEqual({ type: ADD_ISOLATE.REQUESTED, otuId, sourceType, sourceName });
    });

    it("setIsolateAsDefault: returns action to set specific isolate as default", () => {
        const result = setIsolateAsDefault(otuId, isolateId);
        expect(result).toEqual({ type: SET_ISOLATE_AS_DEFAULT.REQUESTED, otuId, isolateId });
    });

    it("editIsolate: returns action to edit a specific isolate", () => {
        const result = editIsolate(otuId, isolateId, sourceType, sourceName);
        expect(result).toEqual({
            type: EDIT_ISOLATE.REQUESTED,
            otuId,
            isolateId,
            sourceType,
            sourceName
        });
    });

    it("removeIsolate: returns action to delete a specific isolate", () => {
        const nextIsolateId = "test-other-isolate";
        const result = removeIsolate(otuId, isolateId, nextIsolateId);
        expect(result).toEqual({
            type: REMOVE_ISOLATE.REQUESTED,
            otuId,
            isolateId,
            nextIsolateId
        });
    });

    it("addSequence: returns action to add a new sequence to an isolate", () => {
        const result = addSequence({ otuId, isolateId, accession, definition, host, sequence, segment, target });
        expect(result).toEqual({
            type: ADD_SEQUENCE.REQUESTED,
            otuId,
            isolateId,
            accession,
            definition,
            host,
            sequence,
            segment,
            target
        });
    });

    it("editSequence: returns action to edit a specific sequence", () => {
        const result = editSequence({
            otuId,
            isolateId,
            sequenceId,
            accession,
            definition,
            host,
            sequence,
            segment,
            target
        });
        expect(result).toEqual({
            type: EDIT_SEQUENCE.REQUESTED,
            otuId,
            isolateId,
            sequenceId,
            accession,
            definition,
            host,
            sequence,
            segment,
            target
        });
    });

    it("removeSequence: returns action to remove a specific sequence", () => {
        const result = removeSequence(otuId, isolateId, sequenceId);
        expect(result).toEqual({
            type: REMOVE_SEQUENCE.REQUESTED,
            otuId,
            isolateId,
            sequenceId
        });
    });

    it("revert: returns action to undo the latest change of a particular otu", () => {
        const changeId = "123abc";
        const otuVersion = 3;
        const result = revert(otuId, otuVersion, changeId);
        expect(result).toEqual({ type: REVERT.REQUESTED, otuId, otuVersion, change_id: changeId });
    });

    it("selectIsolate: returns action to select isolate to expand", () => {
        const result = selectIsolate(isolateId);
        expect(result).toEqual({ type: SELECT_ISOLATE, isolateId });
    });

    it("showEditOTU: returns action to display edit otu modal", () => {
        expect(showEditOTU()).toEqual({ type: SHOW_EDIT_OTU });
    });

    it("showRemoveOTU: returns action to display remove otu modal", () => {
        expect(showRemoveOTU()).toEqual({ type: SHOW_REMOVE_OTU });
    });

    it("showAddIsolate: returns action to display add isolate modal", () => {
        expect(showAddIsolate()).toEqual({ type: SHOW_ADD_ISOLATE });
    });

    it("showEditIsolate: returns action to display edit isolate modal", () => {
        const result = showEditIsolate(otuId, isolateId, sourceType, sourceName);
        expect(result).toEqual({
            type: SHOW_EDIT_ISOLATE,
            otuId,
            isolateId,
            sourceType,
            sourceName
        });
    });

    it("showRemoveIsolate: returns action to display remove isolate modal", () => {
        expect(showRemoveIsolate()).toEqual({ type: SHOW_REMOVE_ISOLATE });
    });

    it("showRemoveSequence: returns action to display remove sequence modal", () => {
        const result = showRemoveSequence(sequenceId);
        expect(result).toEqual({ type: SHOW_REMOVE_SEQUENCE, sequenceId });
    });

    it("hideOTUModal: returns action to hide otu modal", () => {
        expect(hideOTUModal()).toEqual({ type: HIDE_OTU_MODAL });
    });
});
