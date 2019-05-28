import { UPDATE_SETTINGS } from "../../../app/actionTypes";
import { UniqueNames, mapStateToProps, mapDispatchToProps } from "../UniqueNames";

describe("<UniqueNames />", () => {
    it.each([true, false])("should render when [enabled=%p]", enabled => {
        const props = {
            sample_unique_names: enabled
        };
        const wrapper = shallow(<UniqueNames {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it.each([true, false])("should return props when [enabled=true]", enabled => {
        const state = {
            settings: {
                data: {
                    sample_unique_names: enabled
                }
            }
        };

        const props = mapStateToProps(state);

        expect(props).toEqual({ enabled });
    });
});

describe("mapDispatchToProps()", () => {
    it.each([true, false])("should return props when [enabled=true]", enabled => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onToggle(enabled);

        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: { sample_unique_names: enabled }
        });
    });
});
