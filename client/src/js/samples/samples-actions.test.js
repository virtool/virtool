import {
  WS_INSERT_SAMPLE,
  WS_UPDATE_SAMPLE,
  WS_REMOVE_SAMPLE,
  FILTER_SAMPLES,
  FIND_READ_FILES,
  FIND_READY_HOSTS,
  GET_SAMPLE,
  CREATE_SAMPLE,
  UPDATE_SAMPLE,
  UPDATE_SAMPLE_RIGHTS,
  REMOVE_SAMPLE,
  LIST_SAMPLES,
  SHOW_REMOVE_SAMPLE,
  HIDE_SAMPLE_MODAL
} from "../actionTypes";
import {
  wsInsertSample,
  wsUpdateSample,
  wsRemoveSample,
  filterSamples,
  findReadFiles,
  findReadyHosts,
  getSample,
  createSample,
  editSample,
  updateSampleRights,
  removeSample,
  listSamples,
  showRemoveSample,
  hideSampleModal
} from "./actions";

describe("Sample Action Creators:", () => {
  let data;
  let result;
  let expected;
  let sampleId;

  it("wsInsertSample: returns action to insert new entry via websocket", () => {
    data = {
      id: "abc123",
      name: "test"
    };
    result = wsInsertSample(data);
    expected = {
      type: WS_INSERT_SAMPLE,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsUpdateSample: returns action for sample update via websocket", () => {
    data = {
      id: "abc123",
      name: "test-edited"
    };
    result = wsUpdateSample(data);
    expected = {
      type: WS_UPDATE_SAMPLE,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsRemoveSample: returns action for sample removal via websocket", () => {
    data = ["test"];
    result = wsRemoveSample(data);
    expected = {
      type: WS_REMOVE_SAMPLE,
      data
    };
    expect(result).toEqual(expected);
  });

  it("filterSamples: returns action for filtering list by terms", () => {
    const term = "abc";
    result = filterSamples(term);
    expected = {
      type: FILTER_SAMPLES.REQUESTED,
      term
    };
    expect(result).toEqual(expected);
  });

  it("findReadFiles: return simple action to find read files", () => {
    result = findReadFiles();
    expected = {
      type: FIND_READ_FILES.REQUESTED
    };
    expect(result).toEqual(expected);
  });

  it("findReadyHosts: returns simple action to fetch ready hosts", () => {
    result = findReadyHosts();
    expected = {
      type: FIND_READY_HOSTS.REQUESTED
    };
    expect(result).toEqual(expected);
  });

  it("getSample: returns action for getting specific sample", () => {
    sampleId = "testsample";
    result = getSample(sampleId);
    expected = {
      type: GET_SAMPLE.REQUESTED,
      sampleId
    };
    expect(result).toEqual(expected);
  });

  it("createSample: returns action for creating sample", () => {
    const name = "name";
    const isolate = "isolate";
    const host = "host";
    const locale = "locale";
    const srna = false;
    const subtraction = "subtraction";
    const files = {};
    result = createSample(
      name,
      isolate,
      host,
      locale,
      srna,
      subtraction,
      files
    );
    expected = {
      type: CREATE_SAMPLE.REQUESTED,
      name,
      isolate,
      host,
      locale,
      srna,
      subtraction,
      files
    };
    expect(result).toEqual(expected);
  });

  it("editSample: returns action for modifying a sample", () => {
    sampleId = "testid";
    const update = { foo: "bar" };
    result = editSample(sampleId, update);
    expected = {
      type: UPDATE_SAMPLE.REQUESTED,
      sampleId,
      update
    };
    expect(result).toEqual(expected);
  });

  it("updateSampleRights: returns action for updating a sample's permissions", () => {
    sampleId = "testid";
    const update = { foo: "bar" };
    result = updateSampleRights(sampleId, update);
    expected = {
      type: UPDATE_SAMPLE_RIGHTS.REQUESTED,
      sampleId,
      update
    };
    expect(result).toEqual(expected);
  });

  it("removeSample: returns action to remove a sample", () => {
    sampleId = "testid";
    result = removeSample(sampleId);
    expected = {
      type: REMOVE_SAMPLE.REQUESTED,
      sampleId
    };
    expect(result).toEqual(expected);
  });

  it("listSamples: returns action to retrieve page of documents", () => {
    const page = 1;
    result = listSamples(page);
    expected = {
      type: LIST_SAMPLES.REQUESTED,
      page
    };
    expect(result).toEqual(expected);
  });

  it("showRemoveSample: returns simple action", () => {
    result = showRemoveSample();
    expected = {
      type: SHOW_REMOVE_SAMPLE
    };
    expect(result).toEqual(expected);
  });

  it("hideSampleModal: returns simple action", () => {
    result = hideSampleModal();
    expected = {
      type: HIDE_SAMPLE_MODAL
    };
    expect(result).toEqual(expected);
  });
});
