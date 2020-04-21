import { GET_SOFTWARE_UPDATES } from "../../../app/actionTypes";
import { SoftwareUpdateViewer, mapStateToProps, mapDispatchToProps } from "../Viewer";

describe("<SoftwareUpdateViewer />", () => {
    let props;

    beforeEach(() => {
        props = {
            loading: false,
            onGet: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SoftwareUpdateViewer {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render LoadingPlaceholder when loading", () => {
        props.loading = true;
        const wrapper = shallow(<SoftwareUpdateViewer {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onGet() when component mounts", () => {
        shallow(<SoftwareUpdateViewer {...props} />);
        expect(props.onGet).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it.each([
        [true, null],
        [false, [{ id: "foo" }, { id: "bar" }]]
    ])("should return props with loading %p", (loading, releases) => {
        const state = {
            updates: {
                releases
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            loading
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
