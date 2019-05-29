import { UPDATE_SETTINGS } from "../../../app/actionTypes";
import { SentryOptions, mapDispatchToProps, mapStateToProps } from "../Sentry";

describe("<Sentry />", () => {
    let props;

    beforeEach(() => {
        props = { enabled: true, onToggle: jest.fn() };
    });

    it("should render correctly when enabled", () => {
        const wrapper = shallow(<SentryOptions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render correctly when disabled", () => {
        props.enabled = false;
        const wrapper = shallow(<SentryOptions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it.each([true, false])("should return props when [enable_sentry=%p]", enabled => {
        const state = {
            settings: {
                data: {
                    enable_sentry: enabled
                }
            }
        };

        expect(mapStateToProps(state)).toEqual({
            enabled
        });
    });
});

describe("mapDispatchToProps", () => {
    it.each([true, false])("should return functional onToggle() when [enabled=%p]", enabled => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onToggle(enabled);

        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: {
                enable_sentry: enabled
            }
        });
    });
});
