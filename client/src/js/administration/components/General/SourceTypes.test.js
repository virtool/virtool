import { FormControl } from "react-bootstrap";
import { Icon, Checkbox } from "../../../base";
import * as actions from "../../actions";
import * as refActions from "../../../references/actions";
import SourceTypesContainer, { SourceTypeItem, SourceTypes } from "./SourceTypes";

describe("<SourceTypes />", () => {
    let initialState;
    let store;
    let props;
    let wrapper;

    it("renders correctly", () => {
        initialState = {
            references: {
                detail: {
                    restrict_source_types: false,
                    id: "123abc",
                    remotes_from: { id: "test" },
                    source_types: ["foo", "bar"]
                }
            },
            account: {
                administrator: false
            },
            settings: {
                data: {
                    default_source_types: []
                }
            }
        };
        store = mockStore(initialState);
        wrapper = shallow(<SourceTypesContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();

        initialState = {
            references: {
                detail: null
            },
            account: {
                administrator: false
            },
            settings: {
                data: {
                    default_source_types: []
                }
            }
        };
        store = mockStore(initialState);
        wrapper = shallow(<SourceTypesContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("SourceTypes component", () => {
        let spy;
        const initialProps = {
            isGlobalSettings: false,
            onUpdate: sinon.spy(),
            sourceTypesArray: ["test"],
            refId: "123abc"
        };

        it("remove()", () => {
            wrapper = mount(<SourceTypes {...initialProps} />);
            wrapper.instance().remove("test");

            expect(initialProps.onUpdate.calledWith([], false, "123abc")).toBe(true);
        });

        it("handleEnable()", () => {
            props = {
                refId: "",
                restrictSourceTypes: false,
                onToggle: sinon.spy()
            };
            wrapper = mount(<SourceTypes {...initialProps} {...props} />);
            spy = sinon.spy(wrapper.instance(), "handleEnable");
            wrapper.instance().handleEnable();

            expect(spy.calledOnce).toBe(true);

            wrapper.setProps({ refId: "123abc" });
            wrapper.instance().handleEnable();

            expect(spy.calledTwice).toBe(true);
            expect(props.onToggle.calledWith("123abc", true)).toBe(true);
        });

        it("handleSubmit()", () => {
            wrapper = mount(<SourceTypes {...initialProps} />);
            wrapper.setState({ value: "" });

            const mockEvent = { preventDefault: jest.fn() };

            wrapper.instance().handleSubmit(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();

            wrapper.setState({ value: "Test" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(wrapper.state("error")).toEqual("Source type already exists.");

            wrapper.setState({ value: "Test With Spaces" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(wrapper.state("error")).toEqual("Source types may not contain spaces.");

            wrapper.setState({ value: "FooBar" });
            wrapper.instance().handleSubmit(mockEvent);
            expect(initialProps.onUpdate.calledWith(["test", "foobar"], false, "123abc")).toBe(true);
            expect(wrapper.state()).toEqual({ value: "", error: null });
        });
    });

    describe("SourceTypeItem subcomponent", () => {
        it("renders", () => {
            props = {
                onRemove: jest.fn(),
                sourceType: "test",
                isDisabled: false
            };
            wrapper = shallow(<SourceTypeItem {...props} />);
            expect(wrapper).toMatchSnapshot();
        });

        it("click on trash icon calls onRemove callback function", () => {
            props = {
                onRemove: sinon.spy(),
                sourceType: "test",
                isDisabled: true
            };
            wrapper = shallow(<SourceTypeItem {...props} />);
            expect(wrapper.find(Icon).length).toEqual(1);

            wrapper.find(Icon).prop("onClick")();
            expect(props.onRemove.calledWith(props.sourceType)).toBe(true);
        });
    });

    describe("dispatch actions", () => {
        let spyUpdateSetting;
        let spyEditRef;

        beforeAll(() => {
            spyUpdateSetting = sinon.spy(actions, "updateSetting");
            spyEditRef = sinon.spy(refActions, "editReference");

            initialState = {
                references: {
                    detail: {
                        restrict_source_types: false,
                        id: "123abc",
                        remotes_from: null,
                        source_types: []
                    }
                },
                account: {
                    administrator: false
                },
                settings: {
                    data: {
                        default_source_types: []
                    }
                }
            };
            store = mockStore(initialState);
        });

        afterEach(() => {
            spyUpdateSetting.resetHistory();
            spyEditRef.resetHistory();
        });

        afterAll(() => {
            spyUpdateSetting.restore();
            spyEditRef.restore();
            window.history.pushState({}, "Reset URL", "/");
        });

        it("updates global reference 'default_source_types' setting on update", () => {
            window.history.pushState({}, "Test Global Reference Setting", "/refs/settings");
            wrapper = mount(<SourceTypesContainer store={store} />);

            expect(spyUpdateSetting.called).toBe(false);

            wrapper.find(FormControl).prop("onChange")({ target: { value: "test" } });
            wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });

            expect(spyUpdateSetting.calledWith("default_source_types", ["test"])).toBe(true);
        });

        it("edits specific reference 'source_types' setting on update", () => {
            window.history.pushState({}, "Reset URL", "/");
            wrapper = mount(<SourceTypesContainer store={store} />);

            expect(spyEditRef.called).toBe(false);

            wrapper.find(FormControl).prop("onChange")({ target: { value: "test" } });
            wrapper.find("form").prop("onSubmit")({ preventDefault: jest.fn() });

            expect(spyEditRef.calledWith("123abc", { source_types: ["test"] })).toBe(true);
        });

        it("edits specific reference 'restrict_source_types' setting on toggle", () => {
            window.history.pushState({}, "Reset URL", "/");
            wrapper = mount(<SourceTypesContainer store={store} />);

            expect(spyEditRef.called).toBe(false);
            wrapper.find(Checkbox).prop("onClick")();

            expect(spyEditRef.calledWith("123abc", { restrict_source_types: true })).toBe(true);
        });
    });
});
