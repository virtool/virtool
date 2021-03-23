import { find, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { fontWeight, getFontSize } from "../../../app/theme";
import {
    Icon,
    InputError,
    InputGroup,
    InputLabel,
    ListboxButton,
    ListboxInput,
    ListboxList,
    ListboxOption,
    ListboxPopover
} from "../../../base";
import { getTargets } from "../../../otus/selectors";
import { getUnreferencedTargets } from "../../selectors";
import { SequenceTarget } from "./Target";

const TargetFieldLabel = styled(InputLabel)`
    align-items: center;
    display: flex;
`;

const TargetFieldLabelLock = styled.span`
    color: ${props => props.theme.color.grey};
    font-weight: ${fontWeight.thick};
    font-size: ${getFontSize("sm")};
    margin-left: auto;

    span {
        margin-left: 5px;
    }
`;

const TargetFieldListboxInput = styled(ListboxInput)`
    > [data-reach-listbox-button][aria-disabled="true"] {
        opacity: 1;
        color: ${props => props.theme.color.black};
        cursor: default;
    }
`;

export const TargetField = ({ targets, targetValue, onChange }) => {
    const targetSelectOptions = map(targets, target => (
        <ListboxOption key={target.name} value={target.name}>
            <SequenceTarget name={target.name} description={target.description} />
        </ListboxOption>
    ));

    const disabled = targets.length === 0;

    return (
        <InputGroup>
            <TargetFieldLabel>
                <span>Target</span>
                {disabled && (
                    <TargetFieldLabelLock>
                        <Icon name="lock" />
                        <span>All targets in use</span>
                    </TargetFieldLabelLock>
                )}
            </TargetFieldLabel>
            <TargetFieldListboxInput disabled={disabled} value={targetValue.name} onChange={onChange}>
                <ListboxButton>
                    <SequenceTarget name={targetValue.name} description={targetValue.description} />
                </ListboxButton>
                <ListboxPopover>
                    <ListboxList>{targetSelectOptions}</ListboxList>
                </ListboxPopover>
            </TargetFieldListboxInput>
            <InputError />
        </InputGroup>
    );
};

export const mapStateToProps = (state, props) => ({
    targets: getUnreferencedTargets(state),
    targetValue: find(getTargets(state), { name: props.value })
});

export default connect(mapStateToProps)(TargetField);
