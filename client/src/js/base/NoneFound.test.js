import React from "react";
import { NoneFound } from "./NoneFound";
import { ListGroup, ListGroupItem } from "react-bootstrap";

describe("<NoneFound />", () => {
    let wrapper;

    describe("when supplied [noListGroup=false] prop", () => {
        const noun = "test";
        const noListGroup = false;

        wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a ListGroup", () => {
            expect(wrapper.find(ListGroup).exists()).toBe(true);
        });
    });

    describe("when supplied [noListGroup=true] prop", () => {
        const noun = "test";
        const noListGroup = true;

        wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a ListGroupItem without ListGroup container", () => {
            expect(wrapper.find(ListGroupItem).exists()).toBe(true);
        });
    });

});
