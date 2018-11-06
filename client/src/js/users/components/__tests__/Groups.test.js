import { listGroups } from "../../../groups/actions";
import { editUser } from "../../actions";
import { UserGroups, mapStateToProps, mapDispatchToProps } from "../Groups";

describe("<UserGroups />", () => {
    let props;

    beforeEach(() => {
        props = {
            userId: "bob",
            allGroups: ["foo", "bar"],
            memberGroups: ["foo"],
            onList: jest.fn(),
            onEditGroup: jest.fn()
        };
    });

    it("renders", () => {
        const wrapper = shallow(<UserGroups {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <NoneFound /> if no groups available", () => {
        props = {
            ...props,
            allGroups: [],
            memberGroups: []
        };
        const wrapper = shallow(<UserGroups {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onList props when component mounts", () => {
        mount(<UserGroups {...props} />);
        expect(props.onList).toBeCalled();
    });

    describe("calls onEditGroup when group is edited", () => {
        let wrapper;

        beforeEach(() => {
            wrapper = shallow(<UserGroups {...props} />);
        });

        it("enables membership", () => {
            wrapper.instance().handleEdit("bar");
            expect(props.onEditGroup).toBeCalledWith("bob", ["foo", "bar"]);
        });

        it("disables membership", () => {
            wrapper.instance().handleEdit("foo");
            expect(props.onEditGroup).toBeCalledWith("bob", []);
        });
    });

    it("mapStateToProps return props", () => {
        const documents = [{ id: "foo" }];
        const detail = {
            id: "bob",
            groups: ["foo", "bar"]
        };
        const props = mapStateToProps({
            groups: {
                documents
            },
            users: {
                detail
            }
        });
        expect(props).toEqual({
            documents,
            memberGroups: detail.groups,
            userId: detail.id
        });
    });

    describe("mapDispatchToProps", () => {
        let dispatch;
        let props;

        beforeEach(() => {
            dispatch = jest.fn();
            props = mapDispatchToProps(dispatch);
        });

        it("returns onList", () => {
            props.onList();
            expect(dispatch).toBeCalledWith(listGroups());
        });

        it("returns onEditGroup", () => {
            const groups = ["foo", "bar"];
            props.onEditGroup("bob", groups);
            expect(dispatch).toBeCalledWith(editUser("bob", { groups }));
        });
    });
});
