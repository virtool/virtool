import { CreateAPIKeyInfo, mapStateToProps } from "../CreateInfo";

describe("<CreateAPIKeyInfo />", () => {
    it("should render when administrator", () => {
        const wrapper = shallow(<CreateAPIKeyInfo administrator={true} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return null when not administrator", () => {
        const wrapper = shallow(<CreateAPIKeyInfo administrator={false} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it.each([true, false])("should return props with [administrator=%p]", administrator => {
        const state = {
            account: {
                administrator
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            administrator
        });
    });
});
