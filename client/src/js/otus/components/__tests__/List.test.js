import { PUSH_STATE } from "../../../app/actionTypes";
import { mapStateToProps, mapDispatchToProps, OTUsList } from "../List";

describe("<OTUsList />", () => {
    let props;

    beforeEach(() => {
        props = {
            refId: "foo",
            term: "bar",
            verified: true,
            onLoadNextPage: jest.fn(),
            documents: ["foo"],
            page: 1,
            page_count: 1,
            renderRow: true,

            references: { detail: { id: 1 } },
            otus: { verified: true }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<OTUsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [this.props.documents === null]", () => {
        props.documents = null;
        const wrapper = shallow(<OTUsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [this.props.documents.length == false]", () => {
        props.documents = false;
        const wrapper = shallow(<OTUsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount should call onLoadNextPage", () => {
        expect(props.onLoadNextPage).not.toHaveBeenCalled();
        shallow(<OTUsList {...props} />);

        expect(props.onLoadNextPage).toHaveBeenCalledWith("foo", "bar", true, 1);
    });
});

describe("mapStateToProps", () => {
    const state = {
        otus: { verified: true },
        references: { detail: { id: "bar" } }
    };
    const result = mapStateToProps(state);

    expect(result).toEqual({
        refId: "bar",
        verified: true
    });
});

describe("mapDispatchToProps", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);
    it("should return onHide in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: {
                createOTU: false
            }
        });
    });

    describe("mapDispatchToProps", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        it("should return onLoadNextPage in props", () => {
            props.onLoadNextPage("foo", "bar", true, 1);
            expect(dispatch).toHaveBeenCalledWith({
                refId: "foo",
                term: "bar",
                verified: true,
                page: 1,
                type: "FIND_OTUS_REQUESTED"
            });
        });
    });
});
