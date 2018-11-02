import { WS_INSERT_PROCESS, WS_UPDATE_PROCESS, LIST_PROCESSES, GET_PROCESS } from "../../app/actionTypes";
import { wsInsertProcess, wsUpdateProcess, listProcesses, getProcess } from "../actions";

describe("Processes Action Creators", () => {
    it("wsInsertProcess: returns action to insert new process", () => {
        const data = { id: "123abc" };
        const result = wsInsertProcess(data);
        expect(result).toEqual({ type: WS_INSERT_PROCESS, data });
    });

    it("wsUpdateProcess: returns action to update existing process", () => {
        const data = { id: "123abc", foo: "bar" };
        const result = wsUpdateProcess(data);
        expect(result).toEqual({ type: WS_UPDATE_PROCESS, data });
    });

    it("listProcesses: returns action to list all processes", () => {
        expect(listProcesses()).toEqual({ type: LIST_PROCESSES.REQUESTED });
    });

    it("getProcess: returns action to retrieve specific process", () => {
        const processId = "123abc";
        const result = getProcess(processId);
        expect(result).toEqual({ type: GET_PROCESS, processId });
    });
});
