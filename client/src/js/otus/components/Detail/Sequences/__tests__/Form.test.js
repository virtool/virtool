import { SequenceForm } from "../Form";

describe("<SequenceForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            host: "test-host",
            definition: "test-definition",
            segment: "test-segment",
            targetName: "test-target-name",
            sequence: "test-sequence",
            handleChange: jest.fn(),
            handleSubmit: jest.fn(),
            errorSegment: "",
            errorDefinition: "",
            errorSequence: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SequenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
