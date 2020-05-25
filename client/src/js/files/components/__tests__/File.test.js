jest.mock("../../../utils/utils");

import { REMOVE_FILE } from "../../../app/actionTypes";
import { File, mapStateToProps, mapDispatchToProps } from "../File";
import { checkAdminOrPermission } from "../../../utils/utils";

describe("<File />", () => {
    let props;

    beforeEach(() => {
        props = {
            canRemove: true,
            id: "foo",
            name: "foo.fa",
            size: 10,
            uploadedAt: "2018-02-14T17:12:00.000000Z",
            user: { id: "bill" },
            ready: true,
            onRemove: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<File {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [ready=false]", () => {
        props.ready = false;
        const wrapper = shallow(<File {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [user=null]", () => {
        props.user = null;
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
        ownProps = { id: "foo" };
        state = {
            files: {
                documents: [
                    {
                        id: "foo",
                        name: "Foo",
                        user: { id: "bob" },
                        ready: true,
                        reserved: false,
                        size: 1024,
                        uploaded_at: "time_1"
                    },
                    {
                        id: "bar",
                        name: "Bar",
                        user: { id: "bill" },
                        ready: true,
                        reserved: false,
                        size: 2048,
                        uploaded_at: "time_2"
                    }
                ]
            }
        };
    });

    it.each([true, false])("should return expected props when [canRemove=%p]", canRemove => {
        checkAdminOrPermission.mockReturnValue(canRemove);

        const props = mapStateToProps(state, ownProps);

        expect(props).toEqual({
            canRemove,
            id: "foo",
            name: "Foo",
            size: 1024,
            ready: true,
            uploadedAt: "time_1",
            user: { id: "bob" }
        });
        expect(checkAdminOrPermission).toHaveBeenCalledWith(state, "remove_file");
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
