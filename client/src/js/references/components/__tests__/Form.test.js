import { ReferenceForm } from "../Form";

describe("<ReferenceForm />", () => {
    let props;
    beforeEach(() => {
        props = {
            errorFile: "foo",
            errorSelect: "bar",
            name: "fee",
            onChange: jest.fn(),
            errorName: "baz",
            description: "Foo",
            organism: "Bar",
            mode: "clone"
        };
    });

    it("should render when [errorFile!=null]", () => {
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [errorFile=null] and [errorSelect=null]", () => {
        props.errorFile = null;
        props.errorSelect = null;
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [mode=create]", () => {
        props.mode = "create";
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
