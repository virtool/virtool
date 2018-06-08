import { ViewHeader, PageHint } from "./ViewHeader";
import { Badge } from "react-bootstrap";
import { Flex, FlexItem } from "./index";

describe("<ViewHeader />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            page: 1,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper).toMatchSnapshot();
    });
});
