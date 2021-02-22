import { find, map } from "lodash-es";
import { connect } from "react-redux";
import React from "react";
import {
    InputError,
    InputGroup,
    InputLabel,
    ListboxButton,
    ListboxInput,
    ListboxList,
    ListboxOption,
    ListboxPopover
} from "../../../../base";
import { getUnreferencedTargets } from "../../../selectors";
import { SequenceTarget } from "./Target";

export const TargetsField = ({ targets, target, onChange }) => {
    const targetSelectOptions = map(targets, target => (
        <ListboxOption key={target.name} value={target.name}>
            <SequenceTarget name={target.name} description={target.description} />
        </ListboxOption>
    ));

    return (
        <InputGroup>
            <InputLabel>Target</InputLabel>
            <ListboxInput value={target.name} tabIndex={1} onChange={onChange}>
                <ListboxButton>
                    <SequenceTarget name={target.name} description={target.description} />
                </ListboxButton>
                <ListboxPopover>
                    <ListboxList>{targetSelectOptions}</ListboxList>
                </ListboxPopover>
            </ListboxInput>
            <InputError />
        </InputGroup>
    );
};

export const mapStateToProps = (state, ownProps) => {
    const targets = getUnreferencedTargets(state);

    return {
        target: find(targets, { name: ownProps.value }),
        targets
    };
};

export default connect(mapStateToProps)(TargetsField);
