import { NotificationIcon, mapStateToProps } from "../Update";

describe("<NotificationIcon />", () => {
    it("should render full component when [visible=true]", () => {
        const wrapper = shallow(<NotificationIcon visible={true} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render empty div when [visible=false]", () => {
        const wrapper = shallow(<NotificationIcon visible={false} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    let expected;
    let state;
    let props;

    beforeEach(() => {
        state = {
            account: {
                administrator: true
            },
            updates: {
                releases: [
                    {
                        id: "foo"
                    }
                ]
            }
        };
        expected = {
            visible: false
        };
    });

    afterEach(() => {
        expect(props).toEqual(expected);
    });

    it("should have [props.active=true] when conditions satisfied", () => {
        expected.visible = true;
        props = mapStateToProps(state);
    });

    it("should have [props.active=false] when not administrator", () => {
        state.account.administrator = false;
        props = mapStateToProps(state);
    });

    it("should have [props.active=false] when releases not loaded", () => {
        state.updates.releases = null;
        props = mapStateToProps(state);
    });

    it("should have [props.active=false] when releases empty", () => {
        state.updates.releases = [];
        props = mapStateToProps(state);
    });
});
