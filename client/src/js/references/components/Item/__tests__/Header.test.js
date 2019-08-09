import { ReferenceItemHeader } from "../Header";

describe("<ReferenceItemHeader />", () => {
    it("should render", () => {
        const props = {
            createdAt: "2018-01-01T00:00:00.000000Z",
            id: "foo",
            name: "Foo",
            userId: "bob"
        };
        const wrapper = shallow(<ReferenceItemHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
