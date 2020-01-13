import { ReferenceManage, mapStateToProps, mapDispatchToProps } from "../Manage";

describe("<ReferenceManage />", () => {
    let props;

    beforeEach(() => {
        props = {
            detail: {
                id: "foo",
                cloned_from: "bar",
                contributors: "baz",
                description: "boo",
                latest_build: "Foo",
                organism: "Bar",
                remotes_from: "Boo",
                data_type: "Boo"
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ReferenceManage {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            references: {
                detail: { foo: "bar" }
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            detail: { foo: "bar" }
        });
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();

    it("should return checkUpdates() in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.onCheckUpdates("foo");
        expect(dispatch).toHaveBeenCalledWith({ refId: "foo", type: "CHECK_REMOTE_UPDATES_REQUESTED" });
    });

    it("should return updateRemoteReference() in props", () => {
        const props = mapDispatchToProps(dispatch);
        props.onUpdate("bar");
        expect(dispatch).toHaveBeenCalledWith((1, { refId: "foo", type: "CHECK_REMOTE_UPDATES_REQUESTED" }));
        expect(dispatch).toHaveBeenCalledWith((2, { refId: "bar", type: "UPDATE_REMOTE_REFERENCE_REQUESTED" }));
    });
});
