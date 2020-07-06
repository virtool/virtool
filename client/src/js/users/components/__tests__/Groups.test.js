import { editUser } from "../../actions";
import { mapDispatchToProps, mapStateToProps, UserGroups } from "../Groups";

describe("<UserGroups />", () => {
    let props;

    beforeEach(() => {
        props = {
            documents: [{ id: "foo" }, { id: "bar" }, { id: "baz" }],
            memberGroups: ["foo"],
            userId: "bob",
            onEditGroup: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UserGroups {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render LoadingPlaceholder when [documents=null]", () => {
        props.documents = null;
        const wrapper = shallow(<UserGroups {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render NoneFound when [documents=[]]", () => {
        props.documents = [];
        const wrapper = shallow(<UserGroups {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onEditGroup() to disable membership", () => {
        const wrapper = shallow(<UserGroups {...props} />);
        wrapper.find("UserGroup").at(0).prop("onClick")("foo");
        expect(props.onEditGroup).toHaveBeenCalledWith("bob", []);
    });

    it("should call onEditGroup() to enable membership", () => {
        const wrapper = shallow(<UserGroups {...props} />);
        wrapper.find("UserGroup").at(1).prop("onClick")("bar");
        expect(props.onEditGroup).toHaveBeenCalledWith("bob", ["foo", "bar"]);
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const documents = [{ id: "foo" }];
        const groups = ["foo", "bar"];

        const props = mapStateToProps({
            groups: {
                documents
            },
            users: {
                detail: {
                    id: "bob",
                    groups
                }
            }
        });

        expect(props).toEqual({
            documents,
            memberGroups: groups,
            userId: "bob"
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onEditGroup() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        const groups = ["foo", "bar"];

        props.onEditGroup("bob", groups);

        expect(dispatch).toHaveBeenCalledWith(editUser("bob", { groups }));
    });
});
