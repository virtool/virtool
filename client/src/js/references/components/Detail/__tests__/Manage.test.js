import { ReferenceManage, mapStateToProps, mapDispatchToProps } from "../Manage";

describe("<ReferenceManage />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            clonedFrom: { bar: "bee" },
            contributors: "baz",
            description: "boo",
            latestBuild: { Foo: "fee" },
            organism: "Bar",
            remotesFrom: "Boo",
            dataType: "Boo"
        };
    });

    it("should render when [props.remotes_from=null]", () => {
        props.remotes_from = null;
        const wrapper = shallow(<ReferenceManage {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [props.cloned_from={ Bar: 'Bee' }]", () => {
        props.cloned_from = { Bar: "Bee" };
        const wrapper = shallow(<ReferenceManage {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            references: {
                detail: {
                    id: "foo",
                    cloned_from: { bar: "bee" },
                    contributors: "baz",
                    description: "boo",
                    latest_build: { Foo: "fee" },
                    organism: "Bar",
                    remotes_from: "Boo",
                    data_type: "Boo"
                }
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            id: "foo",
            clonedFrom: { bar: "bee" },
            contributors: "baz",
            description: "boo",
            latestBuild: { Foo: "fee" },
            organism: "Bar",
            remotesFrom: "Boo",
            dataType: "Boo"
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
