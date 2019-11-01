import { mapDispatchToProps, mapStateToProps, ReferenceDetailHeader } from "../Header";

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
