import { ReferenceSelectorItem } from "../ReferenceSelectorItem";

describe("<ReferenceSelectorItem />", () => {
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
        const wrapper = shallow(<ReferenceSelectorItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
