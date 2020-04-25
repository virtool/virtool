import { SearchInput } from "../../../base";
import { OTUToolbar, FilterButton } from "../Toolbar";

describe("<OTUToolbar />", () => {
    const props = {
        canModify: true,
        page: 2,
        refId: "baz",
        term: "foo",
        verified: false,
        onFind: jest.fn()
    };

    it("should render", () => {
        const wrapper = shallow(<OTUToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [verified=true]", () => {
        props.verified = true;
        const wrapper = shallow(<OTUToolbar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onFind() when input changes", () => {
        const wrapper = shallow(<OTUToolbar {...props} />);
        const e = { target: { value: "baz" } };
        wrapper.find(SearchInput).simulate("change", e);
        expect(props.onFind).toHaveBeenCalledWith(props.refId, "baz", props.verified, 1);
    });

    it("should call onFind() when filter button is clicked", () => {
        const wrapper = shallow(<OTUToolbar {...props} />);
        wrapper.find("#verified-button").simulate("click");
        expect(props.onFind).toHaveBeenCalledWith(props.refId, props.term, !props.verified, 1);
    });
});
