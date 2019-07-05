import { GET_INDEX, GET_INDEX_HISTORY } from "../../../app/actionTypes";
import { IndexDetail, IndexDetailBreadCrumb, mapStateToProps, mapDispatchToProps } from "../Detail";

describe("<IndexDetailBreadCrumb />", () => {
    it("should render", () => {
        const props = {
            refDetail: {
                id: "baz",
                name: "Baz"
            },
            version: 2
        };
        const wrapper = shallow(<IndexDetailBreadCrumb {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<IndexDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            detail: {
                id: "baz",
                version: 3,
                created_at: "2018-02-14T17:12:00.000000Z",
                user: "bob"
            },
            match: {
                params: {
                    indexId: "baz",
                    refId: "foo"
                }
            },
            refDetail: {
                id: "foo",
                name: "Foo"
            },
            onGetIndex: jest.fn(),
            onGetChanges: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render <NotFound /> when GET_INDEX_ERROR is set", () => {
        props.error = { status: 404 };
        const wrapper = shallow(<IndexDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render <LoadingPlaceholder /> when index or reference detail is null", () => {
        props.detail = null;
        props.refDetail = null;
        const wrapper = shallow(<IndexDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onGetIndex() and getChanges() on mount", () => {
        shallow(<IndexDetail {...props} />);
        expect(props.onGetIndex).toHaveBeenLastCalledWith(props.detail.id);
        expect(props.onGetChanges).toHaveBeenLastCalledWith(props.detail.id, 1);
    });
});

describe("mapStateToProps()", () => {
    let state;

    beforeEach(() => {
        state = {
            errors: {
                GET_OTU_ERROR: {
                    status: 400
                }
            },
            indexes: {
                detail: {
                    id: "bar",
                    version: 2
                }
            },
            references: {
                detail: {
                    id: "foo",
                    name: "Foo"
                }
            }
        };
    });

    it("should return props from state", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            error: null,
            detail: state.indexes.detail,
            refDetail: state.references.detail
        });
    });

    it("should return props from state with error", () => {
        state.errors.GET_INDEX_ERROR = {
            status: 404
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({
            error: { status: 404 },
            detail: state.indexes.detail,
            refDetail: state.references.detail
        });
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;

    beforeEach(() => {
        dispatch = jest.fn();
    });

    it("should return onGetIndex() in props", () => {
        const result = mapDispatchToProps(dispatch);
        const indexId = "foo";
        result.onGetIndex(indexId);
        expect(dispatch).toHaveBeenCalledWith({
            type: GET_INDEX.REQUESTED,
            indexId
        });
    });

    it("should return onGetChanges() in props", () => {
        const result = mapDispatchToProps(dispatch);
        const indexId = "foo";
        result.onGetChanges(indexId, 3);
        expect(dispatch).toHaveBeenCalledWith({
            type: GET_INDEX_HISTORY.REQUESTED,
            indexId,
            page: 3
        });
    });
});
