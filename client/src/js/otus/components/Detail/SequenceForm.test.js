import SequenceForm from "./SequenceForm";

describe("<SequenceForm />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            overlay: null,
            accessionCol: null,
            host: "test-host",
            definition: "test-definition",
            segment: "test-segment",
            sequence: "test-sequence",
            schema: ["hello", "world"],
            handleChange: jest.fn(),
            handleSubmit: jest.fn(),
            errorSegment: "",
            errorDefinition: "",
            errorSequence: ""
        };
        wrapper = shallow(<SequenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
