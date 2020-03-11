import { mapStateToProps, UserItem } from "../Item";

describe("<UserItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "bob",
            identicon: "foobar",
            administrator: false
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
                documents: [{ id: "foo", identicon: "bar", administrator: true }]
            }
        };
        const ownProps = {
            index: 0
        };
        const result = mapStateToProps(state, ownProps);
        expect(result).toEqual({
            id: "foo",
            identicon: "bar",
            administrator: true
        });
    });
});
