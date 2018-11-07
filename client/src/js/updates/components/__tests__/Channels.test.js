import * as actions from "../../../administration/actions";
import SoftwareChannels, { ChannelButton } from "../Channels";

describe("<SoftwareChannels />", () => {
    const initialState = {
        settings: { data: { software_channel: "beta" } }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<SoftwareChannels store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("<ChannelButton /> subcomponent", () => {
        beforeEach(() => {
            props = {
                channel: "stable",
                checked: true,
                onClick: sinon.spy()
            };
        });

        it("renders correctly", () => {
            wrapper = shallow(<ChannelButton {...props} />);
            expect(wrapper).toMatchSnapshot();

            wrapper.setProps({ channel: "testing" });
            expect(wrapper).toMatchSnapshot();
        });

        it("calls onClick callback when radio button is clicked", () => {
            expect(props.onClick.called).toBe(false);

            wrapper = shallow(<ChannelButton {...props} />);
            wrapper.prop("onClick")();

            expect(props.onClick.calledWith(props.channel)).toBe(true);
        });
    });

    it("Clicking on a ChannelButton dispatches updateSetting() action", () => {
        const spy = sinon.spy(actions, "updateSetting");
        expect(spy.called).toBe(false);

        wrapper = mount(<SoftwareChannels store={store} />);
        wrapper
            .find(ChannelButton)
            .at(0)
            .prop("onClick")("stable");
        expect(spy.calledWith("software_channel", "stable")).toBe(true);

        spy.restore();
    });
});
