import { getProcess } from "../selectors";

describe("getProcess()", () => {
    let state;
    beforeEach(() => {
        state = {
            processes: {
                documents: [{ id: "foo" }]
            },
            hmms: { status: { process: { id: "foo" } } }
        };
    });
    it("should return process when it exists", () => {
        const process = getProcess(state);
        expect(process).toEqual({ id: "foo" });
    });
    it("should return process when [processId=undifined]", () => {
        state.hmms.status = undefined;
        const process = getProcess(state);
        expect(process).toBe(undefined);
    });
    it("should return process when [processes.length=0]", () => {
        state.processes.documents = [];
        const process = getProcess(state);
        expect(process).toBe(undefined);
    });
    it("should return process when [processId=undifined] and [processes.length=0]", () => {
        state.hmms.status = undefined;
        state.processes.documents = [];
        const process = getProcess(state);
        expect(process).toBe(undefined);
    });
});
