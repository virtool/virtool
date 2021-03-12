import { DownloadLink } from "../Detail/DownloadLink";
import { screen } from "@testing-library/react";

describe("<DownloadLink />", () => {
    const props = {
        id: 1
    };

    it("should render", () => {
        renderWithProviders(<DownloadLink {...props} />);
        const link = screen.getByText("Download Index").closest("a");
        expect(link).toHaveAttribute("href", `/download/indexes/${props.id}`);
    });
});
