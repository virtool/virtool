import { API, mapStateToProps, mapDispatchToProps } from "../API";
import { UPDATE_SETTINGS } from "../../../app/actionTypes";

describe("<API />", () => {
    let props;

    beforeEach(() => {
        props = {
            enabled: true,
            onToggle: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<API {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [onToggle=true]", () => {
        const wrapper = shallow(<API {...props} />);
        wrapper.find("SettingsCheckbox").simulate("toggle", "foo");
        expect(props.onToggle).toHaveBeenCalledWith("foo");
    });
    it("should render when [onToggle=false]", () => {
        props.enabled = false;
        const wrapper = shallow(<API {...props} />);
        wrapper.find("SettingsCheckbox").simulate("toggle", "foo");
        expect(props.onToggle).toHaveBeenCalledWith("foo");
    });
});

describe("mapStateToProps", () => {
    it("should return props", () => {
        const state = {
            settings: {
                data: {
                    enable_api: true
                }
            }
        };
        const props = mapStateToProps(state);

        expect(props).toEqual({ enabled: true });
    });
});

describe("mapDispatchToProps", () => {
    it("should call dispatch", () => {
        const dispatch = jest.fn();
        const value = "foo";
        const props = mapDispatchToProps(dispatch);
        props.onToggle(value);
        expect(dispatch).toHaveBeenCalledWith({
            update: {
                enable_api: "foo"
            },
            type: UPDATE_SETTINGS.REQUESTED
        });
    });
});
