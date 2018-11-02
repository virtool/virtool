import { Icon } from "../../../base/index";
import { UserItem } from "../Item";

describe("<UserItem />", () => {
    describe("renders", () => {
        let props;

        beforeEach(() => {
            props = {
                id: "bob",
                identicon: "foobar",
                administrator: false
            };
        });

        it("with admin icon when [isAdmin=true]", () => {
            props.administrator = true;
            const wrapper = shallow(<UserItem {...props} />);
            expect(wrapper.find(Icon).length).toBe(1);
            expect(wrapper).toMatchSnapshot();
        });

        it("without icon when [isAdmin=false]", () => {
            const wrapper = shallow(<UserItem {...props} />);
            expect(wrapper.find(Icon).length).toBe(0);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
