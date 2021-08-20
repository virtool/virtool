import { xor } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { getFontSize } from "../../../../app/theme";
import { BoxGroupSection, Icon, Input } from "../../../../base";
import { useFuse } from "../../../../base/hooks";
import { PopoverBody, usePopover } from "../../../../base/Popover";
import { SmallSampleLabel } from "../../Label";
import { SidebarHeaderButton } from "./Header";

const SampleSidebarSelectorItemCheck = styled.div`
    align-items: start;
    color: ${props => props.theme.color.greyDark};
    display: flex;
    justify-content: center;
    margin-right: 5px;
    width: 32px;
`;

const SampleSidebarSelectorInputContainer = styled(BoxGroupSection)`
    padding: 10px;
`;

const StyledSampleSidebarSelectorItem = styled(BoxGroupSection)`
    align-items: stretch;
    display: flex;
    padding: 10px 10px 10px 5px;

    p {
        font-size: ${getFontSize("md")};
        margin: 5px 0 0;
    }
`;

const SmallSampleSubtraction = styled(SmallSampleLabel)`
    border: none;
`;

export const SampleSidebarSelectorItem = ({ checked, color, description, id, name, onClick }) => {
    const handleSelect = useCallback(() => onClick(id), [id, onClick]);

    const smallSampleItem = color ? (
        <SmallSampleLabel color={color} name={name} />
    ) : (
        <SmallSampleSubtraction name={name} />
    );

    return (
        <StyledSampleSidebarSelectorItem as="button" onClick={handleSelect}>
            <SampleSidebarSelectorItemCheck>{checked && <Icon name="check" />}</SampleSidebarSelectorItemCheck>
            <div>
                {smallSampleItem}
                <p>{description}</p>
            </div>
        </StyledSampleSidebarSelectorItem>
    );
};

export const SampleSidebarSelector = ({ sampleItems, selectedItems, sampleId, onUpdate }) => {
    const [results, term, setTerm] = useFuse(sampleItems, ["name"], [sampleId]);

    const [attributes, show, styles, setPopperElement, setReferenceElement, setShow] = usePopover();

    const handleToggle = useCallback(
        labelId => {
            onUpdate(
                sampleId,
                xor(
                    selectedItems.map(label => label.id),
                    [labelId]
                )
            );
        },
        [sampleId, selectedItems, onUpdate]
    );

    const sampleLabelIds = selectedItems.map(label => label.id);

    const labelComponents = results.map(label => (
        <SampleSidebarSelectorItem
            key={label.id}
            checked={sampleLabelIds.includes(label.id)}
            {...label}
            onClick={handleToggle}
        />
    ));

    return (
        <React.Fragment>
            <SidebarHeaderButton type="button" ref={setReferenceElement} onClick={setShow}>
                <Icon name="pen" />
            </SidebarHeaderButton>
            {show && (
                <PopoverBody ref={setPopperElement} show={show} style={styles.popper} {...attributes.popper}>
                    <SampleSidebarSelectorInputContainer>
                        <Input
                            value={term}
                            placeholder="Filter labels"
                            aria-label="Filter labels"
                            onChange={e => setTerm(e.target.value)}
                            autoFocus
                        />
                    </SampleSidebarSelectorInputContainer>
                    {labelComponents}
                </PopoverBody>
            )}
        </React.Fragment>
    );
};
