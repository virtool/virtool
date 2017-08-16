/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UniqueNames
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSettings } from "../../actions";
import { Checkbox, Button } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
const UniqueNames = (props) => {
    return (
        <div>
            <Row>
                <Col md={12}>
                    <h5><strong>Unique Sample Names</strong></h5>
                </Col>
                <Col sm={12} md={6} mdPush={6}>
                    <Panel>
                        Enable this feature to ensure that every created sample has a unique name. If a user
                        attempts to assign an existing name to a new sample an error will be displayed.
                    </Panel>
                </Col>
                <Col sm={12} md={6} mdPull={6}>
                    <Panel>
                        <Button onClick={() => {props.onToggle(!props.enabled)}} block>
                            <Checkbox checked={props.enabled} /> Enable
                        </Button>
                    </Panel>
                </Col>
            </Row>
        </div>
    );
};

UniqueNames.propTypes = {
    enabled: React.PropTypes.bool,
    onToggle: React.PropTypes.func,
};

const mapStateToProps = (state) => {
    return {
        enabled: state.settings.data.sample_unique_names
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onToggle: (enabled) => {
            dispatch(updateSettings({sample_unique_names: enabled}));
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(UniqueNames);

export default Container;
