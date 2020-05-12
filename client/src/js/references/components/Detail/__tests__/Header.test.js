import { mapDispatchToProps, mapStateToProps, ReferenceDetailHeader, ReferenceDetailHeaderIcon } from "../Header";

describe("<ReferenceDetailHeaderIcon />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: true,
            isRemote: true,
            onEdit: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ReferenceDetailHeaderIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [canModify=false]", () => {
        props.canModify = false;
        const wrapper = shallow(<ReferenceDetailHeaderIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [isRemote=false]", () => {
        props.isRemote = false;
        const wrapper = shallow(<ReferenceDetailHeaderIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [both canModify=false, isRemote=false]", () => {
        props.canModify = false;
        props.isRemote = false;
        const wrapper = shallow(<ReferenceDetailHeaderIcon {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onEdit", () => {
        props.isRemote = false;
        const wrapper = shallow(<ReferenceDetailHeaderIcon {...props} />);
        wrapper.find("Icon").at(0).simulate("click");
        expect(props.onEdit).toHaveBeenCalled();
    });
});

describe("<ReferenceDetailHeader/>", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: true,
            createdAt: "foo",
            id: "bar",
            isClone: true,
            isRemote: true,
            name: "baz",
            showIcons: true,
            userId: 1,
            onEdit: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ReferenceDetailHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [showIcons=false]", () => {
        props.showIcons = false;
        const wrapper = shallow(<ReferenceDetailHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            references: {
                detail: {
                    name: "foo",
                    id: 1,
                    cloned_from: "bar",
                    remotes_from: "baz",
                    created_at: "Foo",
                    user: {
                        id: "Bar"
                    }
                }
            },
            account: {
                administrator: true
            },
            router: {
                location: {
                    pathname: "Baz/manage"
                }
            }
        };

        const props = mapStateToProps(state);
        expect(props).toEqual({
            name: "foo",
            canModify: true,
            createdAt: "Foo",
            isRemote: true,
            showIcons: true,
            userId: "Bar"
        });
    });
});
describe("mapDispatchToProps", () => {
    it("should return onEdit() in props", () => {
        const dispatch = jest.fn();
        const result = mapDispatchToProps(dispatch);
        result.onEdit();
        expect(dispatch).toHaveBeenCalledWith({ state: { editReference: true }, type: "PUSH_STATE" });
    });
});
