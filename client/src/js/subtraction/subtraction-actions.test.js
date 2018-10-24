import {
  WS_INSERT_SUBTRACTION,
  WS_UPDATE_SUBTRACTION,
  WS_REMOVE_SUBTRACTION,
  LIST_SUBTRACTIONS,
  FILTER_SUBTRACTIONS,
  GET_SUBTRACTION,
  UPDATE_SUBTRACTION,
  CREATE_SUBTRACTION,
  REMOVE_SUBTRACTION
} from "../actionTypes";
import {
  wsInsertSubtraction,
  wsUpdateSubtraction,
  wsRemoveSubtraction,
  listSubtractions,
  filterSubtractions,
  getSubtraction,
  createSubtraction,
  updateSubtraction,
  removeSubtraction
} from "./actions";

describe("Subtraction Action Creators:", () => {
  let data;
  let subtractionId;
  let result;
  let expected;

  it("wsInsertSubtraction: returns action of websocket insert subtraction data", () => {
    data = {
      file: {
        id: "abc123-test.171",
        name: "test.171"
      },
      id: "testSubtraction",
      job: { id: "jobId" },
      ready: false
    };
    result = wsInsertSubtraction(data);
    expected = {
      type: WS_INSERT_SUBTRACTION,
      data
    };

    expect(result).toEqual(expected);
  });

  it("wsUpdateSubtraction: returns action of websocket update subtraction data", () => {
    data = {
      file: {
        id: "abc123-test.171",
        name: "test.171"
      },
      id: "testSubtraction",
      job: { id: "jobId" },
      ready: true
    };
    result = wsUpdateSubtraction(data);
    expected = {
      type: WS_UPDATE_SUBTRACTION,
      data
    };

    expect(result).toEqual(expected);
  });

  it("wsRemoveSubtraction: returns action of websocket remove subtraction data", () => {
    data = ["testSubtraction"];
    result = wsRemoveSubtraction(data);
    expected = {
      type: WS_REMOVE_SUBTRACTION,
      data
    };

    expect(result).toEqual(expected);
  });

  it("listSubtractions: returns action to retrieve page from subtractions documents", () => {
    const page = 123;
    result = listSubtractions(page);
    expected = {
      type: LIST_SUBTRACTIONS.REQUESTED,
      page
    };

    expect(result).toEqual(expected);
  });

  it("filterSubtractions: returns action to retrieve filtered subtraction documents", () => {
    const term = "test";
    result = filterSubtractions(term);
    expected = {
      type: FILTER_SUBTRACTIONS.REQUESTED,
      term
    };

    expect(result).toEqual(expected);
  });

  it("getSubtraction: returns action to retrieve a subtraction", () => {
    subtractionId = "testerid";
    result = getSubtraction(subtractionId);
    expected = {
      type: GET_SUBTRACTION.REQUESTED,
      subtractionId
    };

    expect(result).toEqual(expected);
  });

  it("createSubtraction: returns action to create a subtraction", () => {
    subtractionId = "testerid";
    const fileId = "fastafile";
    const nickname = "nickname";
    result = createSubtraction(subtractionId, fileId, nickname);
    expected = {
      type: CREATE_SUBTRACTION.REQUESTED,
      subtractionId,
      fileId,
      nickname
    };

    expect(result).toEqual(expected);
  });

  it("updateSubtraction: returns action to modify a subtraction", () => {
    subtractionId = "testerid";
    const nickname = "nickname";
    result = updateSubtraction(subtractionId, nickname);
    expected = {
      type: UPDATE_SUBTRACTION.REQUESTED,
      subtractionId,
      nickname
    };

    expect(result).toEqual(expected);
  });

  it("removeSubtraction: returns action to remove a subtraction", () => {
    subtractionId = "testerid";
    result = removeSubtraction(subtractionId);
    expected = {
      type: REMOVE_SUBTRACTION.REQUESTED,
      subtractionId
    };

    expect(result).toEqual(expected);
  });
});
