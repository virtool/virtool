import { xor } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { BoxGroupSection, Icon, Input, SidebarHeaderButton } from "../../../base";
import { useFuse } from "../../../base/hooks";
import { PopoverBody, usePopover } from "../../../base/Popover";
import { SampleSidebarSelectorItem } from "./SelectorItem";

const SampleSidebarSelectorInputContainer = styled(BoxGroupSection)`
    padding: 10px;
`;

export const SampleSidebarSelector = ({ render, sampleItems, selectedItems, sampleId, onUpdate, selectionType }) => {
    const [results, term, setTerm] = useFuse(sampleItems, ["name"], [sampleId]);
    const [attributes, show, styles, setPopperElement, setReferenceElement, setShow] = usePopover();

    const handleToggle = useCallback(
        itemId => {
            onUpdate(xor(selectedItems, [itemId]));
        },
        [sampleId, selectedItems, onUpdate]
    );
    const sampleItemComponents = results.map(item => (
        <SampleSidebarSelectorItem
            key={item.id}
            checked={selectedItems.includes(item.id)}
            {...item}
            onClick={handleToggle}
        >
            {render(item)}
        </SampleSidebarSelectorItem>
    ));

    return (
        <React.Fragment>
            <SidebarHeaderButton
                aria-label={"select " + selectionType}
                type="button"
                ref={setReferenceElement}
                onClick={setShow}
            >
                <Icon name="pen" />
            </SidebarHeaderButton>
            {show && (
                <PopoverBody ref={setPopperElement} show={show} style={styles.popper} {...attributes.popper}>
                    <SampleSidebarSelectorInputContainer>
                        <Input
                            value={term}
                            placeholder="Filter items"
                            aria-label="Filter items"
                            onChange={e => setTerm(e.target.value)}
                            autoFocus
                        />
                    </SampleSidebarSelectorInputContainer>
                    {sampleItemComponents}
                </PopoverBody>
            )}
        </React.Fragment>
    );
};
