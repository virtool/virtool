import { AnalysisMappingReference, AnalysisMappingSubtraction } from "../Mapping";

describe("AnalysisMappingReference", () => {
    it("should render", () => {
        const props = {
            index: {
                version: 3
            },
            reference: {
                id: "foo",
                name: "Foo"
            }
        };
        const wrapper = shallow(<AnalysisMappingReference {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("AnalysisMappingSubtraction", () => {
    it("should render", () => {
        const props = {
            subtraction: {
                id: "Foo Bar"
            }
        };
        const wrapper = shallow(<AnalysisMappingSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
