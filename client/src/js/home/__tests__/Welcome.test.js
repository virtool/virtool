import { Welcome, mapStateToProps } from "../components/Welcome";

describe("<Welcome />", () => {
    let props;

    beforeEach(() => {
        props = {
            version: true
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Welcome {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [version=false]", () => {
        props.version = false;
        const wrapper = shallow(<Welcome {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should return", () => {
        const state = {
            updates: {
                version: "foo"
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({ version: "foo" });
    });
});
