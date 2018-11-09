import { MemoryRouter } from "react-router-dom";
import { SampleSearchToolbar } from "../Toolbar";

describe("<SampleSearchToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            canCreate: true,
            onFind: jest.fn(),
            term: ""
        };
    });

    describe("renders when [canCreate=true]", () => {
        const wrapper = shallow(<SampleSearchToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    describe("renders when [canCreate=false]", () => {
        const wrapper = shallow(<SampleSearchToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("Change in input dispatches filterSamples() action", () => {
        const wrapper = mount(
            <MemoryRouter>
                <SampleSearchToolbar {...props} />
            </MemoryRouter>
        );
        const e = { target: { value: "foo" } };
        wrapper.find("input").prop("onChange")(e);
        expect(props.onFind).toBeCalledWith(e);
    });
});
