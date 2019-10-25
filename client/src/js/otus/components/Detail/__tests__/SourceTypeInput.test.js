import { SourceTypeInput } from "../SourceTypeInput";

describe("<SourceTypeInput />", () => {
    let props;

    beforeEach(() => {
        props = {
            restrictSourceTypes: true,
            allowedSourceTypes: ["foo", "bar"],
            value: "bar",
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SourceTypeInput {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [restrictSourceTypes=false]", () => {
        props.restrictSourceTypes = false;
        const wrapper = shallow(<SourceTypeInput {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
