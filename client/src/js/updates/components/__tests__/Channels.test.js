import { UPDATE_SETTINGS } from "../../../app/actionTypes";
import { SoftwareChannels, ChannelButton, mapStateToProps, mapDispatchToProps } from "../Channels";

describe("<ChannelButton />", () => {
    let props;

    beforeEach(() => {
        props = {
            channel: "stable",
            checked: true,
            onClick: jest.fn()
        };
    });

    it.each(["stable", "beta"])("should render when [channel=%p]", channel => {
        props.channel = channel;
        const wrapper = shallow(<ChannelButton {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onClick when radio button is clicked", () => {
        const wrapper = shallow(<ChannelButton {...props} />);
        expect(props.onClick).not.toHaveBeenCalled();
        wrapper.prop("onClick")();
        expect(props.onClick).toHaveBeenCalledWith(props.channel);
    });
});

describe("<SoftwareChannels />", () => {
    let props;

    beforeEach(() => {
        props = {
            channel: "stable",
            onSetSoftwareChannel: jest.fn()
        };
    });

    it.each(["stable", "beta", "alpha"])("should render when [channel=%p]", channel => {
        props.channel = channel;
        const wrapper = shallow(<SoftwareChannels {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSetSoftwareChannel() when radio button is clicked", () => {
        const wrapper = shallow(<SoftwareChannels {...props} />);
        wrapper
            .find("ChannelButton")
            .at(1)
            .props()
            .onClick("beta");
        expect(props.onSetSoftwareChannel).toHaveBeenCalledWith("beta");
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            settings: { data: { software_channel: "beta" } }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            channel: "beta"
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onSetSoftwareChannel() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onSetSoftwareChannel("beta");
        expect(dispatch).toHaveBeenCalledWith({
            type: UPDATE_SETTINGS.REQUESTED,
            update: { software_channel: "beta" }
        });
    });
});
