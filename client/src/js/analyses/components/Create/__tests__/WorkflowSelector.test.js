import React from "react";
import { Select } from "../../../../base";
import { getCompatibleWorkflows, WorkflowSelector } from "../WorkflowSelector";
import { WorkflowSelectorItem } from "../WorkflowSelectorItem";

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
            workflows: ["nuvs"],
            onSelect: jest.fn()
        };
    });

    it.each(["amplicon", "normal", "srna"])("should render when [libraryType=%p]", libraryType => {
        props.libraryType = libraryType;
        const wrapper = shallow(<WorkflowSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should have nuvs disabled when [hasHmm=false]", () => {
        props.hasHmm = false;
        const wrapper = shallow(<WorkflowSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange prop when input changes", () => {
        const wrapper = shallow(<WorkflowSelector {...props} />);
        wrapper.find(WorkflowSelectorItem).prop("onSelect")("nuvs");
        expect(props.onSelect).toHaveBeenCalledWith("nuvs");
    });
});
