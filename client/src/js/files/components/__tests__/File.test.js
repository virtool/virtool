jest.mock("../../../utils/utils");

import { REMOVE_FILE } from "../../../app/actionTypes";
import { File, mapStateToProps, mapDispatchToProps } from "../File";
import { checkAdminOrPermission } from "../../../utils/utils";

describe("<File />", () => {
    let props;

    beforeEach(() => {
        props = {
            canRemove: true,
            entry: {
                id: "foo",
                name: "foo.fa",
                size: 10,
                uploaded_at: "2018-02-14T17:12:00.000000Z",
                user: { id: "bill" }
            },
            onRemove: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<File {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [user=null]", () => {
        props.entry.user = null;
        const wrapper = shallow(<File {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [canRemove=false]", () => {
        props.canRemove = false;
        const wrapper = shallow(<File {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should have [props.onRemove] called when trash icon clicked", () => {
        const wrapper = shallow(<File {...props} />);
        wrapper.find("Icon").simulate("click");
        expect(props.onRemove).toHaveBeenCalledWith("foo");
    });
});

describe("mapStateToProps()", () => {
    let ownProps;
    let state;

    beforeEach(() => {
        ownProps = { index: 0 };
        state = {
            files: {
                documents: [{ id: "foo" }, { id: "bar" }]
            }
        };
    });

    it.each([true, false])("should return expected props when [canRemove=%p]", canRemove => {
        checkAdminOrPermission.mockReturnValue(canRemove);
        const props = mapStateToProps(state, ownProps);
        expect(props).toEqual({
            canRemove,
            entry: { id: "foo" }
        });
        expect(checkAdminOrPermission).toHaveBeenCalledWith(state, "remove_file");
    });

    it("should return null [props.entry] when index does not exist", () => {
        checkAdminOrPermission.mockReturnValue(true);
        ownProps.index = 3;
        const props = mapStateToProps(state, ownProps);
        expect(props).toEqual({
            canRemove: true,
            entry: null
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return functional [props.onRemove]", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onRemove("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: REMOVE_FILE.REQUESTED,
            fileId: "foo"
        });
    });
});
