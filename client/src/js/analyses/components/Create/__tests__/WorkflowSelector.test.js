import { screen } from "@testing-library/react";
import React from "react";
import { getCompatibleWorkflows, WorkflowSelector } from "../WorkflowSelector";

describe("getCompatibleWorkflows()", () => {
    it("should return aodp when [dataType='barcode']", () => {
        const result = getCompatibleWorkflows("barcode", false);
        expect(result).toEqual(["aodp"]);
    });

    it("should return pathoscope_bowtie when [dataType='genome'] and [hasHmm=false]", () => {
        const result = getCompatibleWorkflows("genome", false);
        expect(result).toEqual(["pathoscope_bowtie"]);
    });

    it("should return pathoscope_bowtie and nuvs when [dataType='genome'] and [hasHmm=true]", () => {
        const result = getCompatibleWorkflows("genome", true);
        expect(result).toEqual(["pathoscope_bowtie", "nuvs"]);
    });
});

describe("<WorkflowSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            dataType: "genome",
            hasError: false,
            hasHmm: true,
            workflows: ["nuvs"],
            onSelect: jest.fn()
        };
    });

    it.each(["barcode", "genome"])("should render when [dataType=%p]", dataType => {
        props.dataType = dataType;
        renderWithProviders(<WorkflowSelector {...props} />);

        if (dataType === "barcode") {
            expect(screen.getByText("AODP")).toBeInTheDocument();
            expect(screen.queryByText("Pathoscope")).not.toBeInTheDocument();
            expect(screen.queryByText("NuVs")).not.toBeInTheDocument();
        } else {
            expect(screen.getByText("Pathoscope")).toBeInTheDocument();
            expect(screen.getByText("NuVs")).toBeInTheDocument();
            expect(screen.queryByText("AODP")).not.toBeInTheDocument();
        }

        expect(screen.queryByText("Workflow(s) must be selected")).not.toBeInTheDocument();
    });

    it("should have NuVs disabled when [hasHmm=false]", () => {
        props.hasHmm = false;
        renderWithProviders(<WorkflowSelector {...props} />);

        expect(screen.getByText("Pathoscope")).toBeInTheDocument();
        expect(screen.queryByText("NuVs")).not.toBeInTheDocument();
    });

    it("should render error when [hasError=true]", () => {
        props.hasError = true;
        renderWithProviders(<WorkflowSelector {...props} />);

        expect(screen.queryByText("Workflow(s) must be selected")).toBeInTheDocument();
    });

    it("should call onChange when item clicked", () => {
        renderWithProviders(<WorkflowSelector {...props} />);

        screen.getByRole("button", { name: "NuVs" }).click();
        expect(props.onSelect).toHaveBeenCalledWith([]);
    });
});
