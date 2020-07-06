import { LibraryTypeSelector } from "../LibraryTypeSelector";

describe("<LibraryTypeSelector>", () => {
    let props;
    beforeEach(() => {
        props = {
            onSelect: jest.fn(),
            libraryType: "normal"
        };
    });

    it("should have Normal selected [libraryType='normal']", () => {
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should have sRNA selected when [libraryType='srna']", () => {
        props.libraryType = "srna";
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should have Amplicon selected when [libraryType='amplicon']", () => {
        props.libraryType = "amplicon";
        const wrapper = shallow(<LibraryTypeSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSelect with libraryType normal when Normal type is clicked", () => {
        const { getByText } = renderWithProviders(<LibraryTypeSelector {...props} />);
        fireEvent.click(getByText("Normal"));
        expect(props.onSelect).toHaveBeenCalledWith("normal");
    });
    it("should call onSelect with libraryType srna when srna type is clicked", () => {
        const { getByText } = renderWithProviders(<LibraryTypeSelector {...props} />);
        fireEvent.click(getByText("sRNA"));
        expect(props.onSelect).toHaveBeenCalledWith("srna");
    });
    it("should call onSelect with libraryType amplicon when amplicon type is clicked", () => {
        const { getByText } = renderWithProviders(<LibraryTypeSelector {...props} />);
        fireEvent.click(getByText("Amplicon"));
        expect(props.onSelect).toHaveBeenCalledWith("amplicon");
    });
});
