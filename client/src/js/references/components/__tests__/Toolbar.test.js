import { MemoryRouter } from "react-router-dom";
import { ReferenceToolbar } from "../Toolbar";

describe("<ReferenceToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            canCreate: true,
            term: "",
            onFind: jest.fn()
        };
    });

    it("renders when [canCreate=true]", () => {
        const wrapper = shallow(<ReferenceToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders when [canCreate=false]", () => {
        props.canCreate = false;
        const wrapper = shallow(<ReferenceToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders when [term='foo']", () => {
        props.term = "foo";
        const wrapper = shallow(<ReferenceToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onFind when input changes", () => {
        const wrapper = mount(
            <MemoryRouter>
                <ReferenceToolbar {...props} />
            </MemoryRouter>
        );
        const e = { target: { value: "baz" } };
        wrapper.find("input").prop("onChange")(e);
        expect(props.onFind).toBeCalledWith(e);
    });
});
