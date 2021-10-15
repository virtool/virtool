import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { createStore } from "redux";
import { CreateSubtraction } from "../Create";
import { SubtractionFileItem } from "../FileSelector";

const routerRenderWithProviders = (ui, store) => {
    const routerUi = <BrowserRouter> {ui} </BrowserRouter>;
    return renderWithProviders(routerUi, store);
};

describe("<SubtractionFileItem />", () => {
    it.each([true, false])("should render when [active=%p]", active => {
        const props = {
            active,
            name: "test",
            uploaded_at: "2018-02-14T17:12:00.000000Z",
            user: { id: "test-user" }
        };
        const wrapper = shallow(<SubtractionFileItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateSubtraction />", () => {
    let props;
    let state;

    beforeEach(() => {
        props = {
            show: true,
            files: [{ id: "test" }],
            error: "",
            onCreate: jest.fn(),
            onListFiles: jest.fn(),
            onHide: jest.fn(),
            onClearError: jest.fn()
        };
        state = {
            files: {
                documents: [
                    {
                        count: 0,
                        description: "",
                        id: 2,
                        name: "testSubtraction1",
                        type: "subtraction",
                        user: "testUser",
                        uploaded_at: "2021-10-14T20:57:36.558000Z"
                    },
                    {
                        count: 0,
                        description: "",
                        id: 3,
                        name: "testSubtraction2",
                        type: "subtraction",
                        user: "testUser",
                        uploaded_at: "2021-10-14T20:57:36.558000Z"
                    }
                ]
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when no files available", () => {
        state.files.documents = [];
        routerRenderWithProviders(<CreateSubtraction {...props} />, createAppStore(state));
        expect(screen.getByText(/no files found/i)).toBeInTheDocument();
    });

    it.each([
        ["name", "Foo"],
        ["nickname", "Bar"]
    ])("should render after %p input changes", (name, value) => {
        routerRenderWithProviders(<CreateSubtraction {...props} />, createAppStore(state));
        userEvent.type(screen.getByRole("textbox", { name: "name" }), value);
        expect(screen.getByDisplayValue(value)).toBeInTheDocument();
    });

    it("should render error when submitted with no name or file entered", async () => {
        routerRenderWithProviders(
            <BrowserRouter>
                <CreateSubtraction {...props} />
            </BrowserRouter>,
            createAppStore(state)
        );
        const name = "testSubtractionname";
        const nickname = "testSubtractionNickname";
        userEvent.type(screen.getByRole("textbox", { name: "name" }), name);
        userEvent.type(screen.getByRole("textbox", { name: "nickname" }), nickname);
        userEvent.click(screen.getByText(/testsubtraction1/i));
        userEvent.click(screen.getByText(/save/i));

        const uploadId = state.files.documents[0].id;

        await waitFor(() => expect(props.onCreate).toHaveBeenCalledWith({ uploadId, name, nickname }));
    });

    it("should call onListFiles() when modal enters", () => {
        props.show = false;
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(props.onListFiles).not.toHaveBeenCalled();

        wrapper.setProps({ show: true });

        setTimeout(() => expect(props.onListFiles).toHaveBeenCalledWith(), 500);
    });
});

const createAppStore = state => {
    return () => {
        const mockReducer = state => {
            return state;
        };
        return createStore(mockReducer, state);
    };
};
