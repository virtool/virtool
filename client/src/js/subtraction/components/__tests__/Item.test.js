import { SubtractionItem, SubtractionItemIcon, mapStateToProps } from "../Item";

describe("<SubtractionItemIcon />", () => {
    it.each([true, false])("should render when [ready=%p]", ready => {
        const wrapper = shallow(<SubtractionItemIcon ready={ready} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<SubtractionItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            name: "Foo",
            ready: true
        };
    });

    it.each([true, false])("should render when [ready=%p]", ready => {
        props.ready = ready;
        const wrapper = shallow(<SubtractionItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            subtraction: {
                documents: [
                    { id: "foo", name: "Foo", ready: true },
                    { id: "bar", name: "Bar", ready: true },
                    { id: "baz", name: "Baz", ready: true }
                ]
            }
        };
        const props = mapStateToProps(state, { index: 1 });
        expect(props).toEqual({
            id: "bar",
            name: "Bar",
            ready: true
        });
    });
});
