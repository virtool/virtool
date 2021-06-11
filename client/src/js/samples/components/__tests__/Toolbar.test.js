import { SearchInput } from "../../../base";
import { SampleSearchToolbar } from "../Toolbar";

describe("<SampleSearchToolbar />", () => {
    let props;

    beforeEach(() => {
        props = {
            canCreate: true,
            initialTerm: "foo",
            onFind: jest.fn()
        };
    });

    it.each([true, false])("should render when [canCreate=%p]", canCreate => {
        props.canCreate = canCreate;
        const wrapper = shallow(<SampleSearchToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onFind() when input changes", () => {
        const wrapper = shallow(<SampleSearchToolbar {...props} />);
        const e = { target: { value: "foo" } };

        wrapper.find(SearchInput).simulate("change", e);

        expect(props.onFind).toHaveBeenCalledWith("foo");
    });
});
