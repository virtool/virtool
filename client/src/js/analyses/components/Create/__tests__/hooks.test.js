import { act, renderHook } from "@testing-library/react-hooks";
import { useCreateAnalysis } from "../hooks";

describe("useCreateAnalysis()", () => {
    const defaultSubtraction = "baz";

    let dataType = "genome";
    let rerender;
    let result;

    beforeEach(() => {
        const renderObj = renderHook(() => useCreateAnalysis(dataType, defaultSubtraction));

        result = renderObj.result;
        rerender = renderObj.rerender;
    });

    it("should set errors", () => {
        expect(result.current.errors).toEqual({});

        act(() => {
            result.current.setErrors({
                references: false,
                workflows: true
            });
        });

        expect(result.current.errors).toEqual({
            references: false,
            workflows: true
        });
    });

    it("should set subtraction", () => {
        expect(result.current.subtraction).toEqual(defaultSubtraction);

        act(() => {
            result.current.setSubtractions("foo");
        });

        expect(result.current.subtraction).toEqual("foo");
    });

    it("should set references and unset error", () => {
        act(() => {
            result.current.setErrors({
                references: true,
                workflows: true
            });
        });

        expect(result.current.errors).toEqual({ references: true, workflows: true });

        act(() => {
            result.current.setReferences(["foo"]);
        });

        expect(result.current.references).toEqual(["foo"]);
        expect(result.current.errors).toEqual({ references: false, workflows: true });
    });

    it("should set workflows and unset error", () => {
        act(() => {
            result.current.setWorkflows(["foo"]);
            result.current.setErrors({
                references: true,
                workflows: true
            });
        });

        expect(result.current.workflows).toEqual(["foo"]);
        expect(result.current.errors).toEqual({ references: true, workflows: true });

        act(() => {
            result.current.setWorkflows(["foo", "bar"]);
        });

        expect(result.current.workflows).toEqual(["foo", "bar"]);
        expect(result.current.errors).toEqual({ references: true, workflows: false });

        act(() => {
            result.current.setWorkflows([]);
        });

        expect(result.current.workflows).toEqual([]);
    });

    it("should empty references and workflows and unset errors when dataType changes", () => {
        act(() => {
            result.current.setReferences(["foo"]);
            result.current.setWorkflows(["bar", "baz"]);
            result.current.setErrors({
                references: true,
                workflows: true
            });
        });

        expect(result.current.references).toEqual(["foo"]);
        expect(result.current.workflows).toEqual(["bar", "baz"]);

        dataType = "barcode";
        rerender();

        expect(result.current.references).toEqual([]);
        expect(result.current.workflows).toEqual([]);
    });
});
