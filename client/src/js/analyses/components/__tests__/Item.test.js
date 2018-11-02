import { MemoryRouter } from "react-router";
import * as actions from "../../actions";
import AnalysisItemContainer, { AnalysisItem } from "../Item";

describe("<AnalysisItem />", () => {
    const initialState = {
        references: {
            detail: {
                restrict_source_types: false,
                id: "123abc",
                remotes_from: null,
                source_types: []
            }
        },
        account: {
            administrator: true,
            groups: []
        },
        settings: {
            data: {
                default_source_types: []
            }
        },
        samples: {
            detail: { all_write: false, group_write: false, group: "" }
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            id: "test_analysis",
            ready: false,
            placeholder: true,
            algorithm: "test_algorithm",
            created_at: "2018-02-14T17:12:00.000000Z"
        };
        wrapper = shallow(<AnalysisItemContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders base component correctly", () => {
        props = {
            id: "test_analysis",
            ready: true,
            placeholder: false,
            algorithm: "test_algorithm",
            created_at: "2018-02-14T17:12:00.000000Z",
            reference: { name: "123abc" },
            index: { version: 123 },
            user: { id: "test-user" }
        };
        wrapper = shallow(<AnalysisItem {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking trash icon dispatches remove action to delete entry", () => {
        const spy = sinon.spy(actions, "removeAnalysis");
        expect(spy.called).toBe(false);

        props = {
            id: "test_analysis",
            ready: true,
            placeholder: false,
            algorithm: "test_algorithm",
            created_at: "2018-02-14T17:12:00.000000Z",
            reference: { name: "123abc" },
            index: { version: 123 },
            user: { id: "test-user" }
        };
        wrapper = mount(
            <MemoryRouter>
                <AnalysisItemContainer store={store} {...props} />
            </MemoryRouter>
        );

        wrapper
            .find({ name: "trash" })
            .at(0)
            .prop("onClick")();
        expect(spy.calledWith(props.id)).toBe(true);

        spy.restore();
    });
});
