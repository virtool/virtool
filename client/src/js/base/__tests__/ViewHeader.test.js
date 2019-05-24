import { Badge } from "react-bootstrap";
import { ViewHeader } from "../ViewHeader";

describe("<ViewHeader />", () => {
    let wrapper;

    it("should render with title", () => {
        wrapper = shallow(<ViewHeader title="Foo" />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with count", () => {
        wrapper = shallow(<ViewHeader title="Foo" count={10} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render renders children", () => {
        wrapper = shallow(
            <ViewHeader title="test-child">
                <div>Hello world</div>
            </ViewHeader>
        );
        expect(wrapper).toMatchSnapshot();
    });
});
