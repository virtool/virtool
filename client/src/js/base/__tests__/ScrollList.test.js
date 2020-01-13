import { ScrollList } from "../ScrollList";

describe("<ScrollList />", () => {
    let props;

    beforeEach(() => {
        props = {
            isElement: true,
            document: [{ foo: "bar" }],
            page: 1,
            pageCount: 2,
            onLoadNextPage: jest.fn()
        };
    });

    it("should return LoadingPlaceholder when [documents=null] and [page<pageCount]", () => {
        props.documents = null;
        const wrapper = mount(<ScrollList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return React.Fragment when [noContainer=true]", () => {
        const wrapper = mount(<ScrollList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [noContainer=false]", () => {
        props.noContainer = false;
        const wrapper = mount(<ScrollList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount() should call addEventListener()", () => {
        window.addEventListener = jest.fn();
        window.removeEventListener = jest.fn();

        const wrapper = mount(<ScrollList {...props} />);

        expect(window.addEventListener).toHaveBeenCalledWith("scroll", wrapper.instance().onScroll);
    });

    it("componentWillUnmount() should call removeEventListener()", () => {
        window.addEventListener = jest.fn();
        window.removeEventListener = jest.fn();

        const wrapper = mount(<ScrollList {...props} />);
        const onScroll = wrapper.instance().onScroll;
        wrapper.unmount();

        expect(window.removeEventListener).toHaveBeenCalledWith("scroll", onScroll);
    });
});
