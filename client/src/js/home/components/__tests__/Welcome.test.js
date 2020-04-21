import { Welcome, mapStateToProps } from "../Welcome";

describe("<Welcome />", () => {
    let props;

    beforeEach(() => {
        props = {
            mongoVersion: "3.6.3",
            version: "v1.2.3"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Welcome {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each([
        ["3.6.3", null],
        [null, "v1.2.3"],
        [null, null]
    ])("should render LoadingPlaceholder when version information is (%p, %p)", (mongoVersion, version) => {
        props.mongoVersion = mongoVersion;
        props.version = version;
        const wrapper = shallow(<Welcome {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should return props", () => {
        const state = {
            updates: {
                version: "foo"
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({ version: "foo" });
    });
});
