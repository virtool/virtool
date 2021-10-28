import { mapStateToProps, UserItem } from "../Item";

describe("<UserItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "b8vkclwp",
            administrator: false,
            handle: "bob"
        };
    });

    it.each([true, false])("should render when administrator=%p]", administrator => {
        props.administrator = administrator;
        const wrapper = shallow(<UserItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            users: {
                documents: [{ id: "foo", administrator: true }]
            }
        };
        const ownProps = {
            index: 0
        };
        const result = mapStateToProps(state, ownProps);
        expect(result).toEqual({
            id: "foo",
            administrator: true
        });
    });
});
