import { MemoryRouter } from "react-router";
import * as refActions from "../../references/actions";
import * as actions from "../actions";
import IndexDetailContainer, { IndexDetail } from "./Detail";

describe("<Detail />", () => {
    const initialState = {
        errors: null,
        indexes: {
            detail: {
                id: "test-index",
                version: 0,
                created_at: "2018-02-14T17:12:00.000000Z",
                user: { id: "test-user" },
                change_count: 3
            }
        },
        references: {
            detail: {
                name: "reference"
            }
        }
    };
    const store = mockStore(initialState);
    const match = {
        params: {
            indexId: "test-index",
            refId: "test-reference"
        }
    };
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<IndexDetailContainer store={store} match={match} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <NotFound /> when GET_INDEX_ERROR is set", () => {
        props = {
            error: { status: 404 },
            onGetIndex: jest.fn(),
            onGetReference: jest.fn(),
            onGetChanges: jest.fn()
        };
        wrapper = shallow(<IndexDetail {...props} match={match} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <LoadingPlaceholder /> when index or reference detail data is unavailable", () => {
        props = {
            detail: null,
            refDetail: null,
            onGetIndex: jest.fn(),
            onGetReference: jest.fn(),
            onGetChanges: jest.fn()
        };
        wrapper = shallow(<IndexDetail {...props} match={match} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("Component mount dispatches getIndex(), getIndexHistory(), getReference() actions", () => {
        const spyIndex = sinon.spy(actions, "getIndex");
        const spyIndexHistory = sinon.spy(actions, "getIndexHistory");
        const spyReference = sinon.spy(refActions, "getReference");

        expect(spyIndex.called).toBe(false);
        expect(spyIndexHistory.called).toBe(false);
        expect(spyReference.called).toBe(false);

        wrapper = mount(
            <MemoryRouter>
                <IndexDetailContainer store={store} match={match} />
            </MemoryRouter>
        );

        expect(spyIndex.calledWith("test-index")).toBe(true);
        expect(spyIndexHistory.calledWith("test-index", 1)).toBe(true);
        expect(spyReference.calledWith("test-reference")).toBe(true);

        spyIndex.restore();
        spyIndexHistory.restore();
        spyReference.restore();
    });
});
