import { Indexes } from "../Indexes";

describe("<Indexes />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [{ id: "foo" }, { id: "bar" }],
            onLoadNextPage: jest.fn(),
            refId: "baz"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Indexes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with empty documents array", () => {
        props.documents = [];
        const wrapper = shallow(<Indexes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [documents=null]", () => {
        props.documents = null;
        const wrapper = shallow(<Indexes {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onLoadNextPage on mount", () => {
        shallow(<Indexes {...props} />);
        expect(props.onLoadNextPage).toHaveBeenCalledWith(props.refId, 1);
    });
});
