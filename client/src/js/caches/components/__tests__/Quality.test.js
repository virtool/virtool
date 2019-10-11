import { CacheQuality, mapStateToProps } from "../Quality.js";

describe("<CacheQuality />", () => {
    it("should render", () => {
        const props = {
            foo: "bar"
        };
        const wrapper = shallow(<CacheQuality {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const quality = {
            bases: "foo",
            composition: "bar",
            sequences: "baz"
        };

        const state = {
            caches: {
                detail: {
                    quality
                }
            }
        };

        const props = mapStateToProps(state);

        expect(props).toEqual(quality);
    });
});
