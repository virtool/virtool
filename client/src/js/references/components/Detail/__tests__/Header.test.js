import {
    mapDispatchToProps,
    mapStateToProps,
    ReferenceDetailHeader,
    ReferenceDetailHeaderExportButton,
    ReferenceDetailHeaderIcon
} from "../Header";

describe("<ReferenceDetailHeaderExportButton />", () => {
    let props;
    beforeEach(() => {
        props = {
            isClone: true,
            onSelect: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ReferenceDetailHeaderExportButton {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [isClone = false]", () => {
        props.isClone = false;
        const wrapper = shallow(<ReferenceDetailHeaderExportButton {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should call onSelect prop of ReferenceDetailHeaderExportButton", () => {
        const wrapper = shallow(<ReferenceDetailHeaderExportButton {...props} />);
        expect(props.onSelect).not.toHaveBeenCalled();
        wrapper
            .find("MenuItem")
            .at(0)
            .simulate("select");
        expect(props.onSelect).toHaveBeenCalled();
    });
});

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
        wrapper
            .find("Icon")
            .at(0)
            .simulate("click");
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
    it("should render when[showIcons=false]", () => {
        props.showIcons = false;
        const wrapper = shallow(<ReferenceDetailHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
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
        id: 1,
        name: "foo",
        canModify: true,
        createdAt: "Foo",
        isClone: true,
        isRemote: true,
        showIcons: true,
        userId: "Bar"
    });
});
describe("mapDispatchToProps", () => {
    const dispatch = jest.fn();
    const result = mapDispatchToProps(dispatch);
    result.onEdit();
    expect(dispatch).toHaveBeenCalledWith({ state: { editReference: true }, type: "PUSH_STATE" });
});
