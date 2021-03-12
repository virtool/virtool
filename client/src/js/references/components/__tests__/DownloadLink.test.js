import { DownloadLink } from "../Detail/DownloadLink";
import { screen } from "@testing-library/react";

describe("<DownloadLink />", () => {
    const props = {
        onSelect: jest.fn(),
        id: 1
    };

    it("should render", () => {
        const wrapper = shallow(<DownloadLink {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should download the correct link when clicked", () => {
        renderWithProviders(<DownloadLink {...props} />);
        const link = screen.getByText("Download Index").closest("a");
        expect(link).toHaveAttribute("href", `/download/indexes/${props.id}`);
    });
});
