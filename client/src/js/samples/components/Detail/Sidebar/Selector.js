import { xor } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize } from "../../../../app/theme";
import { BoxGroupSection, Icon, Input, LoadingPlaceholder } from "../../../../base";
import { useFuse } from "../../../../base/hooks";
import { PopoverBody, usePopover } from "../../../../base/Popover";
import { getLabels } from "../../../../labels/selectors";
import { editSample } from "../../../actions";
import { getSampleDetailId, getSampleLabels } from "../../../selectors";
import { SmallSampleLabel } from "../../Label";
import { SidebarHeaderButton } from "./Header";

const SampleLabelsSelectorItemCheck = styled.div`
    align-items: start;
    color: ${props => props.theme.color.greyDark};
    display: flex;
    justify-content: center;
    margin-right: 5px;
    width: 32px;
`;

const SampleLabelsSelectorInputContainer = styled(BoxGroupSection)`
    padding: 10px;
`;

const StyledSampleLabelsSelectorItem = styled(BoxGroupSection)`
    align-items: stretch;
    display: flex;
    padding: 10px 10px 10px 5px;

    p {
        font-size: ${getFontSize("md")};
        margin: 5px 0 0;
    }
`;

export const SampleLabelsSelectorItem = ({ checked, color, description, id, name, onClick }) => {
    const handleSelect = useCallback(() => onClick(id), [id, onClick]);

    return (
        <StyledSampleLabelsSelectorItem as="button" onClick={handleSelect}>
            <SampleLabelsSelectorItemCheck>{checked && <Icon name="check" />}</SampleLabelsSelectorItemCheck>
            <div>
                <SmallSampleLabel color={color} name={name} />
                <p>{description}</p>
            </div>
        </StyledSampleLabelsSelectorItem>
    );
};

export const SampleLabelsSelector = ({ allLabels, sampleLabels, sampleId, onUpdate }) => {
    const [results, term, setTerm] = useFuse(allLabels, ["name"], [sampleId]);

    const [attributes, show, styles, setPopperElement, setReferenceElement, setShow] = usePopover();

    const handleToggle = useCallback(
        labelId => {
            onUpdate(
                sampleId,
                xor(
                    sampleLabels.map(label => label.id),
                    [labelId]
                )
            );
        },
        [sampleId, sampleLabels, onUpdate]
    );

    const sampleLabelIds = sampleLabels[0].id ? sampleLabels.map(label => label.id) : sampleLabels;

    if (!results) {
        return <LoadingPlaceholder />;
    }

    const labelComponents = results.map(label => (
        <SampleLabelsSelectorItem
            key={label.id}
            checked={sampleLabelIds.includes(label.id)}
            // color={label.color || "#1D4ED8"}
            // description={label.description || "[Description Placeholder]"}
            {...label}
            onClick={handleToggle}
        />
    ));

    // console.log("labelComponents", labelComponents);
    console.log("results", results);

    return (
        <React.Fragment>
            <SidebarHeaderButton type="button" ref={setReferenceElement} onClick={setShow}>
                <Icon name="pen" />
            </SidebarHeaderButton>
            {show && (
                <PopoverBody ref={setPopperElement} show={show} style={styles.popper} {...attributes.popper}>
                    <SampleLabelsSelectorInputContainer>
                        <Input
                            value={term}
                            placeholder="Filter labels"
                            aria-label="Filter labels"
                            onChange={e => setTerm(e.target.value)}
                            autoFocus
                        />
                    </SampleLabelsSelectorInputContainer>
                    {labelComponents}
                </PopoverBody>
            )}
        </React.Fragment>
    );
};

export const mapStateToProps = state => ({
    allLabels: getLabels(state),
    sampleId: getSampleDetailId(state),
    sampleLabels: getSampleLabels(state)
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: (sampleId, labels) => {
        dispatch(editSample(sampleId, { labels }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleLabelsSelector);
