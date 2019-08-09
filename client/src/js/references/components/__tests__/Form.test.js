import ReferenceForm from "../Form";

describe("<ReferenceForm />", () => {
    let props = {
        state: {
            name: "test",
            description: "test-description",
            dataType: "test-datatype",
            organism: "test-organism",
            onChange: jest.fn(),
            errorName: "",
            errorDataType: ""
        }
    };

    it("should render without errors", () => {
        props = {
            state: {
                ...props.state,
                errorFile: null,
                errorSelect: null
            }
        };
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with errors", () => {
        props = {
            state: {
                ...props.state,
                errorFile: null,
                errorSelect: "Error Select"
            }
        };
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
