import { GET_SOFTWARE_UPDATES } from "../../../app/actionTypes";
import { SoftwareUpdateViewer, mapStateToProps, mapDispatchToProps } from "../Viewer";

describe("<SoftwareUpdateViewer />", () => {
    let props;

    beforeEach(() => {
        props = {
            channel: "stable",
            releases: [{ id: "foo" }, { id: "bar" }],
            onGet: jest.fn()
        };
    });

    it("should render when releases available", () => {
        const wrapper = shallow(<SoftwareUpdateViewer {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render placeholder when [releases=null]", () => {
        props.releases = null;
        const wrapper = shallow(<SoftwareUpdateViewer {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onGet() when component mounts", () => {
        shallow(<SoftwareUpdateViewer {...props} />);
        expect(props.onGet).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const releases = [{ id: "foo" }, { id: "bar" }];
        const state = {
            settings: {
                data: {
                    software_channel: "stable"
                }
            },
            updates: {
                releases
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            channel: "stable",
            releases
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onGet() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onGet();
        expect(dispatch).toHaveBeenCalledWith({
            type: GET_SOFTWARE_UPDATES.REQUESTED
        });
    });
});
