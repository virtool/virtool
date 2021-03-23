import { SequenceForm } from "../Form";

describe("<SequenceForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            accession: "test-accession",
            host: "test-host",
            definition: "test-definition",
            errors: {
                accession: "",
                sequence: ""
            },
            sequence: "test-sequence",
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SequenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
