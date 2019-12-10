import { ReferenceSelectItem } from "../ReferenceSelectItem";

describe("<ReferenceSelectItem />", () => {
    let props;
    beforeEach(() => {
        props = {
            reference: {
                name: "foo",
                otu_count: "bar",
                created_at: "boo",
                user: {
                    id: "foo"
                }
            },
            onClick: jest.fn()
        };
    });
    it("should render", () => {
        const wrapper = shallow(<ReferenceSelectItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
