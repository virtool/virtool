import { Settings } from "../Settings";

describe("<Settings />", () => {
    let props;

    beforeEach(() => {
        props = {
            settings: {
                enable_api: true,
                enable_sentry: true
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Settings {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render placeholder when loading", () => {
        props.settings = null;
        const wrapper = shallow(<Settings {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
