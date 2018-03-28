import React from "react";
import { NoneFound } from "../../js/base/NoneFound";

// noun (string), noListGroup (boolean)
// renders listgroup item message with no nouns found, or message itself


describe("<NoneFound />", () => {
    let wrapper;

    describe("when supplied [noListGroup=false] prop", () => {
        const noun = "test";
        const noListGroup = false;

        beforeEach(() => {
            wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);
        });

        it("renders correctly", () => {
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a ListGroup", () => {
            const inst = wrapper.instance();
    
            expect(inst).toBeInstanceOf(NoneFound);
        });
    });


    it("renders a ListGroupItem when noListGroup prop is true", () => {
        noListGroup = true;

        expect(wrapper.type()).toBe("img");
    });

});
