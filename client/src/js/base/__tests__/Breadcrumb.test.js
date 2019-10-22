import { BreadcrumbItem } from "../Breadcrumb";

describe("<BreadcrumbItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            children: "foo",
            to: "bar"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<BreadcrumbItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return when [to=null]", () => {
        props.to = null;
        const wrapper = shallow(<BreadcrumbItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
