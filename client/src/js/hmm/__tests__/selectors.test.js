import { getTask } from "../selectors";

describe("getTask()", () => {
    let state;
    beforeEach(() => {
        state = {
            tasks: {
                documents: [{ id: "foo" }]
            },
            hmms: { status: { task: { id: "foo" } } }
        };
    });
    it("should return task when it exists", () => {
        const task = getTask(state);
        expect(task).toEqual({ id: "foo" });
    });
    it("should return task when [taskId=undifined]", () => {
        state.hmms.status = undefined;
        const task = getTask(state);
        expect(task).toBe(undefined);
    });
    it("should return task when [tasks.length=0]", () => {
        state.tasks.documents = [];
        const task = getTask(state);
        expect(task).toBe(undefined);
    });
    it("should return task when [taskId=undefined] and [tasks.length=0]", () => {
        state.hmms.status = undefined;
        state.tasks.documents = [];
        const task = getTask(state);
        expect(task).toBe(undefined);
    });
});
