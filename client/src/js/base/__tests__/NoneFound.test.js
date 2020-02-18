import { NoneFound } from "../NoneFound";
import { Icon } from "../Icon";

describe("<NoneFound />", () => {
    let wrapper;

    it("renders an info Icon component", () => {
        const noun = "test";

        wrapper = shallow(<NoneFound noun={noun} />);

        expect(wrapper.find(Icon).exists()).toBe(true);
        expect(wrapper.find(Icon).prop("name")).toEqual("info-circle");
        expect(wrapper).toMatchSnapshot();
    });

    describe("when supplied [noListGroup=false] prop", () => {
        const noun = "test";
        const noListGroup = false;

        beforeEach(() => {
            wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);
        });

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe("when supplied [noListGroup=true] prop", () => {
        const noun = "test";
        const noListGroup = true;

        beforeEach(() => {
            wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);
        });

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a Box without ListGroup container", () => {
            expect(wrapper.find("Box").exists()).toBe(true);
        });
    });
});
