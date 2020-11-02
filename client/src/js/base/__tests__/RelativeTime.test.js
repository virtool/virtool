import { act, screen } from "@testing-library/react";
import { RelativeTime } from "../RelativeTime";

const fakeTime = "2019-02-10T17:11:00.000000Z";
const RealDate = Date;

describe("<RelativeTime />", () => {
    beforeAll(() => {
        Date.now = jest.fn();
        Date.now.mockReturnValue(new Date("2019-04-22T10:20:30Z"));
    });

    it("should render 2 months ago", async () => {
        renderWithProviders(<RelativeTime time={fakeTime} />);
        expect(screen.getByText("2 months ago")).toHaveTextContent("2 months ago");
    });

    it("should re-render when time prop changes", async () => {
        const { rerender } = renderWithProviders(<RelativeTime time={fakeTime} />);
        expect(screen.getByText("2 months ago")).toBeInTheDocument();

        // Add one month to the time prop.
        rerender(<RelativeTime time="2019-01-10T12:21:00.000000Z" />);

        expect(await screen.queryByText("2 months ago")).toBeNull();
        expect(await screen.getByText("3 months ago")).toBeInTheDocument();
    });

    it("should re-render when time string changes", async () => {
        jest.useFakeTimers();

        // Render with time that is only 10 seconds before the current (mocked) time.
        renderWithProviders(<RelativeTime time="2019-04-22T10:20:20Z" />);
        expect(await screen.getByText("10 seconds ago")).toBeInTheDocument();

        act(() => {
            Date.now.mockReturnValue(new Date("2019-04-22T10:20:40Z"));
            jest.advanceTimersToNextTimer();
        });

        expect(await screen.findByText("20 seconds ago")).toBeInTheDocument();
    });

    afterAll(() => {
        Date = RealDate;
    });
});
