import { AsyncTypeahead } from "react-bootstrap-typeahead";
import * as actions from "../../../administration/actions";
import * as refActions from "../../actions";
import InternalControlContainer from "./InternalControl";

describe("<InternalControl />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly", () => {
        initialState = {
            settings: {
                data: {},
                readahead: null,
                readaheadPending: false
            },
            references: {
                detail: {
                    internal_control: "",
                    id: "123abc",
                    remotes_from: null
                }
            }
        };
        store = mockStore(initialState);
        wrapper = shallow(<InternalControlContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch actions", () => {
        let spyReadahead;
        let spyUpdate;

        beforeAll(() => {
            spyReadahead = sinon.spy(actions, "getControlReadahead");
            spyUpdate = sinon.spy(refActions, "editReference");

            initialState = {
                settings: {
                    data: {},
                    readahead: ["foo", "bar"],
                    readaheadPending: false
                },
                references: {
                    detail: {
                        internal_control: "foo",
                        id: "123abc",
                        remotes_from: null
                    }
                }
            };
            store = mockStore(initialState);
            wrapper = mount(<InternalControlContainer store={store} />);
        });

        afterAll(() => {
            spyReadahead.restore();
            spyUpdate.restore();
        });

        it("typing in search term dispatches getControlReadahead action", () => {
            expect(spyReadahead.called).toBe(false);
            wrapper.find(AsyncTypeahead).prop("onSearch")("search-term");
            expect(spyReadahead.calledWith("123abc", "search-term")).toBe(true);
        });

        it("selecting a search term results in internal control setting updating", () => {
            expect(spyUpdate.called).toBe(false);
            wrapper.find(AsyncTypeahead).prop("onChange")([{ id: "bar" }]);
            expect(spyUpdate.calledWith("123abc", { internal_control: "bar" })).toBe(true);

            wrapper.find(AsyncTypeahead).prop("onChange")([]);
            expect(spyUpdate.calledWith("123abc", { internal_control: "" })).toBe(true);
        });

        it("renders menu items from search results", () => {
            const result = wrapper.find(AsyncTypeahead).prop("renderMenuItemChildren")({ id: "test", name: "example" });
            expect(result.type).toEqual("option");
        });
    });
});
