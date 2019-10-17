import React from "react";
import ReleasesList from "../List.js";
import Release from "../Release.js";
import { Releases } from "../Releases.js";

describe("<ReleasesList />", () => {
    let props;

    beforeEach(() => {
        props = {
            releases: [
                {
                    name: "foo",
                    body: "Foo",
                    html_url: "FOO"
                }
            ],
            onShowInstall: jest.fn()
        };
    });

    it("should render with one release", () => {
        const wrapper = shallow(<ReleasesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with two releases", () => {
        props = {
            releases: [
                {
                    name: "foo",
                    body: "Foo",
                    html_url: "FOO"
                },
                {
                    name: "bar",
                    body: "Bar",
                    html_url: "BAR"
                }
            ],
            onShowInstall: jest.fn()
        };

        const wrapper = shallow(<ReleasesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onShowInstall when Button clicked", () => {
        const wrapper = shallow(<ReleasesList {...props} />);

        expect(props.onShowInstall).not.toHaveBeenCalled();
        wrapper.find("Button").simulate("click");
        expect(props.onShowInstall).toHaveBeenCalled();
    });
});
