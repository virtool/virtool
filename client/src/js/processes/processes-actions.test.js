import {
  WS_INSERT_PROCESS,
  WS_UPDATE_PROCESS,
  LIST_PROCESSES,
  GET_PROCESS
} from "../actionTypes";
import {
  wsInsertProcess,
  wsUpdateProcess,
  listProcesses,
  getProcess
} from "./actions";

describe("Processes Action Creators", () => {
  let data;
  let result;
  let expected;

  it("wsInsertProcess: returns action to insert new process", () => {
    data = { id: "123abc" };
    result = wsInsertProcess(data);
    expected = { type: WS_INSERT_PROCESS, data };
    expect(result).toEqual(expected);
  });

  it("wsUpdateProcess: returns action to update existing process", () => {
    data = { id: "123abc", foo: "bar" };
    result = wsUpdateProcess(data);
    expected = { type: WS_UPDATE_PROCESS, data };
    expect(result).toEqual(expected);
  });

  it("listProcesses: returns action to list all processes", () => {
    result = listProcesses(data);
    expected = { type: LIST_PROCESSES.REQUESTED };
    expect(result).toEqual(expected);
  });

  it("getProcess: returns action to retrieve specific process", () => {
    const processId = "123abc";
    result = getProcess(processId);
    expected = { type: GET_PROCESS, processId };
    expect(result).toEqual(expected);
  });
});
