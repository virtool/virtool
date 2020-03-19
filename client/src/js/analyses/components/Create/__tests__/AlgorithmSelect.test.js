import React from "react";
import { Select } from "../../../../base";
import { AlgorithmSelect } from "../AlgorithmSelect";

describe("<AlgorithmSelect />", () => {
    let props;

    beforeEach(() => {
        props = {
            libraryType: "normal",
            value: "pathoscope_bowtie",
            onChange: jest.fn(),
            hasHmm: true
        };
    });

    it.each(["amplicon", "normal", "srna"])("should render when [libraryType=%p]", libraryType => {
        props.libraryType = libraryType;
        const wrapper = shallow(<AlgorithmSelect {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should have nuvs disabled when [hasHmm=false]", () => {
        props.hasHmm = false;
        const wrapper = shallow(<AlgorithmSelect {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange prop when input changes", () => {
        const wrapper = shallow(<AlgorithmSelect {...props} />);
        const e = {
            target: {
                value: "foo"
            }
        };
        wrapper.find(Select).simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith(e);
    });
});
