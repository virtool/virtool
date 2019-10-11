import { CacheDetail, mapStateToProps, mapDispatchToProps } from "../Detail";
import { GET_CACHE } from "../../../app/actionTypes";

describe("<CacheDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            detail: {
                hash: "123abc",
                program: "foo",
                created_at: "2018-01-01T00:00:00.000000Z",
                parameters: {
                    foo: "bar"
                }
            },
            match: {
                params: {
                    cacheId: "baz"
                }
            },
            sampleName: "Foo",
            onGet: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CacheDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [detail=null]", () => {
        props.detail = null;
        const wrapper = shallow(<CacheDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            caches: {
                detail: "foo"
            },

            samples: {
                detail: {
                    name: "bar"
                }
            }
        };

        const props = mapStateToProps(state);
        expect(props).toEqual({
            detail: "foo",
            sampleName: "bar"
        });
    });
});

describe("mapDispatchToProps", () => {
    it("should return onGet() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onGet("foo");
        expect(dispatch).toHaveBeenCalledWith({
            type: GET_CACHE.REQUESTED,
            cacheId: "foo"
        });
    });
});
