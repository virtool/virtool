import { MemoryRouter } from "react-router";
import { push } from "connected-react-router";
import ReferenceItemContainer, { ReferenceHeader, ReferenceMetadata, getOrigin, Item } from "../Item";

describe("<Item />", () => {
    const initialState = {
        processes: {
            documents: [{ id: "123abc", progress: 1, step: "test" }]
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    beforeEach(() => {
        props = {
            process: { id: "123abc" },
            created_at: "2018-01-01T00:00:00.000000Z",
            data_type: "test-genome",
            id: "test-reference-id",
            name: "Tester",
            organism: "test-virus",
            user: { id: "test-user" }
        };
    });

    it("renders correctly", () => {
        wrapper = shallow(<ReferenceItemContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders base component correctly", () => {
        props = { ...props, processes: [] };
        wrapper = shallow(<Item {...props} />);
        expect(wrapper).toMatchSnapshot();

        props = {
            ...props,
            processes: [{ id: "123abc", progress: 0.5, step: "test" }]
        };
        wrapper = shallow(<Item {...props} />);
        expect(wrapper).toMatchSnapshot();

        props = {
            ...props,
            processes: [{ id: "345def", progress: 1, step: "test" }]
        };
        wrapper = shallow(<Item {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <ReferenceHeader /> subcomponent correctly", () => {
        props = {
            name: props.name,
            createdAt: props.created_at,
            user: props.user.id,
            refId: props.id
        };
        wrapper = shallow(<ReferenceHeader {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <ReferenceMetadata /> subcomponent correctly", () => {
        props = {
            id: props.id,
            data_type: props.data_type,
            organism: props.organism,
            origin: { method: "Imported from", data: { name: "test-import" } },
            latest_build: {
                id: "test-build",
                version: 0,
                created_at: "2018-01-01T00:00:00.000000Z",
                user: props.user
            },
            progress: 100
        };
        wrapper = shallow(<ReferenceMetadata {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            origin: {
                method: "Cloned from",
                data: { id: "123clone", name: "test-clone" }
            },
            organism: "",
            progress: 0
        });
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            origin: { method: "Remotes from", data: { slug: "test-slug" } }
        });
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            origin: { method: "Created", data: "No File" }
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("getOrigin() helper function", () => {
        props = { imported_from: { foo: "bar" } };
        let result = getOrigin(props);
        let expected = { method: "Imported from", data: props.imported_from };
        expect(result).toEqual(expected);

        props = { cloned_from: { hello: "world" } };
        result = getOrigin(props);
        expected = { method: "Cloned from", data: props.cloned_from };
        expect(result).toEqual(expected);

        props = { remotes_from: { test: "example" } };
        result = getOrigin(props);
        expected = { method: "Remotes from", data: props.remotes_from };
        expect(result).toEqual(expected);

        result = getOrigin({});
        expected = { method: "Created", data: "No File" };
        expect(result).toEqual(expected);
    });

    it("Clicking on reference card dispatches router location change", () => {
        const spy = sinon.spy(store, "dispatch");
        expect(spy.called).toBe(false);

        wrapper = mount(
            <MemoryRouter initialEntries={["/refs/"]}>
                <ReferenceItemContainer store={store} {...props} />
            </MemoryRouter>
        );

        let mockEvent = {
            target: { nodeName: "A" }
        };
        wrapper
            .children()
            .children()
            .children()
            .prop("onClick")(mockEvent);
        expect(spy.called).toBe(false);

        mockEvent = {
            target: { nodeName: "DIV" }
        };
        wrapper
            .children()
            .children()
            .children()
            .prop("onClick")(mockEvent);
        expect(spy.calledWith(push("/refs/test-reference-id"))).toBe(true);

        spy.restore();
    });
});
