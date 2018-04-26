import SequenceField from "./SequenceField";

describe("<SequenceField />", () => {
    let props;
    let wrapper;

    it("renders correctly with props", () => {
        props = {
            sequence: "tester",
            readOnly: true,
            onChange: jest.fn(),
            error: "test error"
        };

        wrapper = shallow(<SequenceField {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly without props", () => {
        wrapper = shallow(<SequenceField />);

        expect(wrapper).toMatchSnapshot();
    });

});
