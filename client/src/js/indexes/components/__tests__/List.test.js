import { IndexesList } from "../List";

describe("<IndexesList />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [{ id: "foo" }, { id: "bar" }],
            onLoadNextPage: jest.fn(),
            refId: "baz"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with empty documents array", () => {
        props.documents = [];
        const wrapper = shallow(<IndexesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [documents=null]", () => {
        props.documents = null;
        const wrapper = shallow(<IndexesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onLoadNextPage on mount", () => {
        shallow(<IndexesList {...props} />);
        expect(props.onLoadNextPage).toHaveBeenCalledWith(props.refId, 1);
    });
});
