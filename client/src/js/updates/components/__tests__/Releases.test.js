import { push } from "connected-react-router";
import { PUSH_STATE } from "../../../app/actionTypes";
import { Releases, mapDispatchToProps, mapStateToProps } from "../Releases";

describe("<Releases />", () => {
    let props;

    beforeEach(() => {
        props = {
            releases: [{ name: "foo" }, { name: "b" }],
            onShowInstall: jest.fn()
        };
    });

    it("should render when there are releases", () => {
        const wrapper = shallow(<Releases {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when there are no releases (up-to-date)", () => {
        props.releases = [];
        const wrapper = shallow(<Releases {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onShowInstall when onShowInstall called on <ReleasesList />", () => {
        const wrapper = shallow(<Releases {...props} />);
        wrapper
            .find("ReleasesList")
            .props()
            .onShowInstall();
        expect(props.onShowInstall).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const releases = [{ name: "foo" }, { name: "b" }];
        const state = {
            updates: {
                releases
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            releases
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onShowInstall() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onShowInstall();
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: { install: true }
        });
    });
});
