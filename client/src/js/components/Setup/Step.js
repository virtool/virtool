/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupStep
 */

import React from "react";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

const SetupStep = (props) => (
    <ListGroupItem
        disabled={props.disabled}
        onClick={() => props.setActiveStepIndex(props.index)}
        active={props.active}
    >
        {props.index + 1}. {props.label}
        <span style={{marginTop: "1px", marginBottom: "-1px"}} className="pull-right">
            {props.ready ? <Icon name="checkmark" />: null}
        </span>
    </ListGroupItem>
);

SetupStep.propTypes = {
    index: React.PropTypes.number.isRequired,
    label: React.PropTypes.string.isRequired,
    setActiveStepIndex: React.PropTypes.func.isRequired,
    ready: React.PropTypes.bool,
    active: React.PropTypes.bool,
    disabled: React.PropTypes.bool
};

SetupStep.defaultProps = {
    ready: false,
    disabled: false
};

export default SetupStep;
