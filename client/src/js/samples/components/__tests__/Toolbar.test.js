import { MemoryRouter } from "react-router-dom";
import { SampleSearchToolbar } from "../Toolbar";

describe("<SampleSearchToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            canCreate: true,
            onFind: jest.fn(),
            term: "",
            pathoscope: [true, false],
            nuvs: [true, false, "ip"]
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
        const wrapper = shallow(<SampleSearchToolbar {...props} />);
        const e = { target: { value: "foo" } };

        wrapper.find("FormControl").simulate("change", e);

        expect(props.onFind).toBeCalledWith("foo", props.pathoscope, props.nuvs);
    });
});
