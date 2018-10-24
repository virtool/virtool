import {
  WS_INSERT_OTU,
  WS_UPDATE_OTU,
  WS_REMOVE_OTU,
  LIST_OTUS,
  FIND_OTUS,
  GET_OTU,
  GET_OTU_HISTORY,
  CREATE_OTU,
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
  SELECT_ISOLATE,
  SHOW_EDIT_OTU,
  SHOW_REMOVE_OTU,
  SHOW_ADD_ISOLATE,
  SHOW_EDIT_ISOLATE,
  SHOW_REMOVE_ISOLATE,
  SHOW_ADD_SEQUENCE,
  SHOW_EDIT_SEQUENCE,
  SHOW_REMOVE_SEQUENCE,
  HIDE_OTU_MODAL
} from "../actionTypes";
import {
  wsInsertOTU,
  wsUpdateOTU,
  wsRemoveOTU,
  listOTUs,
  findOTUs,
  getOTU,
  getOTUHistory,
  createOTU,
  editOTU,
  removeOTU,
  addIsolate,
  setIsolateAsDefault,
  editIsolate,
  removeIsolate,
  addSequence,
  editSequence,
  removeSequence,
  revert,
  selectIsolate,
  showEditOTU,
  showRemoveOTU,
  showAddIsolate,
  showEditIsolate,
  showRemoveIsolate,
  showAddSequence,
  showEditSequence,
  showRemoveSequence,
  hideOTUModal
} from "./actions";

describe("OTUs Action Creators", () => {
  let data;
  let refId;
  let otuId;
  let isolateId;
  let sequenceId;
  let result;
  let expected;

  it("wsInsertOTU: returns action to insert OTU entry via websocket", () => {
    data = { id: "test" };
    result = wsInsertOTU(data);
    expected = { type: WS_INSERT_OTU, data };
    expect(result).toEqual(expected);
  });

  it("wsUpdateOTU: returns action to update OTU entry via websocket", () => {
    data = { id: "test", foo: "bar" };
    result = wsUpdateOTU(data);
    expected = { type: WS_UPDATE_OTU, data };
    expect(result).toEqual(expected);
  });

  it("wsRemoveOTU: returns action to remove OTU entry via websocket", () => {
    data = ["test"];
    result = wsRemoveOTU(data);
    expected = { type: WS_REMOVE_OTU, data };
    expect(result).toEqual(expected);
  });

  it("listOTUs: returns action to list specific page of otu documents", () => {
    refId = "123abc";
    const page = 1;
    result = listOTUs(refId, page);
    expected = { type: LIST_OTUS.REQUESTED, refId, page };
    expect(result).toEqual(expected);
  });

  it("findOTUs: returns action to retrieve otu documents according to current url parameters", () => {
    refId = "123abc";
    result = findOTUs(refId);
    expected = { type: FIND_OTUS.REQUESTED, refId };
    expect(result).toEqual(expected);
  });

  it("getOTU: returns action to retrieve a specific otu", () => {
    otuId = "test-otu";
    result = getOTU(otuId);
    expected = { type: GET_OTU.REQUESTED, otuId };
    expect(result).toEqual(expected);
  });

  it("getOTUHistory: returns action to retrieve change history of specific otu", () => {
    otuId = "test-otu";
    result = getOTUHistory(otuId);
    expected = { type: GET_OTU_HISTORY.REQUESTED, otuId };
    expect(result).toEqual(expected);
  });

  it("createOTU: returns action to create a new otu", () => {
    refId = "123abc";
    const name = "new otu";
    const abbreviation = "NEW";
    result = createOTU(refId, name, abbreviation);
    expected = { type: CREATE_OTU.REQUESTED, refId, name, abbreviation };
    expect(result).toEqual(expected);
  });

  it("editOTU: return action to edit a specific otu", () => {
    otuId = "test-otu";
    const name = "target-otu";
    const abbreviation = "OLD";
    const schema = [];
    result = editOTU(otuId, name, abbreviation, schema);
    expected = { type: EDIT_OTU.REQUESTED, otuId, name, abbreviation, schema };
    expect(result).toEqual(expected);
  });

  it("removeOTU: returns action to delete specific otu", () => {
    refId = "123abc";
    otuId = "test-otu";
    const history = {};
    result = removeOTU(refId, otuId, history);
    expected = { type: REMOVE_OTU.REQUESTED, refId, otuId, history };
    expect(result).toEqual(expected);
  });

  it("addIsolate: returns action to add an isolate to an otu", () => {
    otuId = "test-otu";
    const sourceType = "isolate";
    const sourceName = "tester";
    result = addIsolate(otuId, sourceType, sourceName);
    expected = { type: ADD_ISOLATE.REQUESTED, otuId, sourceType, sourceName };
    expect(result).toEqual(expected);
  });

  it("setIsolateAsDefault: returns action to set specific isolate as default", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    result = setIsolateAsDefault(otuId, isolateId);
    expected = { type: SET_ISOLATE_AS_DEFAULT.REQUESTED, otuId, isolateId };
    expect(result).toEqual(expected);
  });

  it("editIsolate: returns action to edit a specific isolate", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    const sourceType = "isolate";
    const sourceName = "tester";
    result = editIsolate(otuId, isolateId, sourceType, sourceName);
    expected = {
      type: EDIT_ISOLATE.REQUESTED,
      otuId,
      isolateId,
      sourceType,
      sourceName
    };
    expect(result).toEqual(expected);
  });

  it("removeIsolate: returns action to delete a specific isolate", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    const nextIsolateId = "test-other-isolate";
    result = removeIsolate(otuId, isolateId, nextIsolateId);
    expected = {
      type: REMOVE_ISOLATE.REQUESTED,
      otuId,
      isolateId,
      nextIsolateId
    };
    expect(result).toEqual(expected);
  });

  it("addSequence: returns action to add a new sequence to an isolate", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    sequenceId = "test-sequence";
    const definition = "test-definition";
    const host = "test-host";
    const sequence = "test-sequence";
    const segment = "test-segment";
    result = addSequence(
      otuId,
      isolateId,
      sequenceId,
      definition,
      host,
      sequence,
      segment
    );
    expected = {
      type: ADD_SEQUENCE.REQUESTED,
      otuId,
      isolateId,
      sequenceId,
      definition,
      host,
      sequence,
      segment
    };
    expect(result).toEqual(expected);
  });

  it("editSequence: returns action to edit a specific sequence", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    sequenceId = "test-sequence";
    const definition = "test-definition";
    const host = "test-host";
    const sequence = "test-sequence";
    const segment = "test-segment";
    result = editSequence(
      otuId,
      isolateId,
      sequenceId,
      definition,
      host,
      sequence,
      segment
    );
    expected = {
      type: EDIT_SEQUENCE.REQUESTED,
      otuId,
      isolateId,
      sequenceId,
      definition,
      host,
      sequence,
      segment
    };
    expect(result).toEqual(expected);
  });

  it("removeSequence: returns action to remove a specific sequence", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    sequenceId = "test-sequence";
    result = removeSequence(otuId, isolateId, sequenceId);
    expected = {
      type: REMOVE_SEQUENCE.REQUESTED,
      otuId,
      isolateId,
      sequenceId
    };
    expect(result).toEqual(expected);
  });

  it("revert: returns action to undo the latest change of a particular otu", () => {
    otuId = "test-otu";
    const changeId = "123abc";
    result = revert(otuId, changeId);
    expected = { type: REVERT.REQUESTED, otuId, change_id: changeId };
    expect(result).toEqual(expected);
  });

  it("selectIsolate: returns action to select isolate to expand", () => {
    isolateId = "test-isolate";
    result = selectIsolate(isolateId);
    expected = { type: SELECT_ISOLATE, isolateId };
    expect(result).toEqual(expected);
  });

  it("showEditOTU: returns action to display edit otu modal", () => {
    result = showEditOTU();
    expected = { type: SHOW_EDIT_OTU };
    expect(result).toEqual(expected);
  });

  it("showRemoveOTU: returns action to display remove otu modal", () => {
    result = showRemoveOTU();
    expected = { type: SHOW_REMOVE_OTU };
    expect(result).toEqual(expected);
  });

  it("showAddIsolate: returns action to display add isolate modal", () => {
    result = showAddIsolate();
    expected = { type: SHOW_ADD_ISOLATE };
    expect(result).toEqual(expected);
  });

  it("showEditIsolate: returns action to display edit isolate modal", () => {
    otuId = "test-otu";
    isolateId = "test-isolate";
    const sourceType = "isolate";
    const sourceName = "tester";
    result = showEditIsolate(otuId, isolateId, sourceType, sourceName);
    expected = {
      type: SHOW_EDIT_ISOLATE,
      otuId,
      isolateId,
      sourceType,
      sourceName
    };
    expect(result).toEqual(expected);
  });

  it("showRemoveIsolate: returns action to display remove isolate modal", () => {
    result = showRemoveIsolate();
    expected = { type: SHOW_REMOVE_ISOLATE };
    expect(result).toEqual(expected);
  });

  it("showAddSequence: returns action to display add sequence modal", () => {
    result = showAddSequence();
    expected = { type: SHOW_ADD_SEQUENCE };
    expect(result).toEqual(expected);
  });

  it("showEditSequence: returns action to display edit sequence modal", () => {
    sequenceId = "test-sequence";
    result = showEditSequence(sequenceId);
    expected = { type: SHOW_EDIT_SEQUENCE, sequenceId };
    expect(result).toEqual(expected);
  });

  it("showRemoveSequence: returns action to display remove sequence modal", () => {
    sequenceId = "test-sequence";
    result = showRemoveSequence(sequenceId);
    expected = { type: SHOW_REMOVE_SEQUENCE, sequenceId };
    expect(result).toEqual(expected);
  });

  it("hideOTUModal: returns action to hide otu modal", () => {
    result = hideOTUModal();
    expected = { type: HIDE_OTU_MODAL };
    expect(result).toEqual(expected);
  });
});
