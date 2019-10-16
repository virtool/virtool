import { IndexOTU } from "../OTU";

describe("<IndexOTU />", () => {
    let props;

    beforeEach(() => {
        props = {
            refId: "foo",
            changeCount: 1,
            id: "bar",
            name: "baz"
        };
    });

    it("should render when [changeCount = 1]", () => {
        const wrapper = shallow(<IndexOTU {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [changeCount = 2]", () => {
        props.changeCount = 2;
        const wrapper = shallow(<IndexOTU {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
