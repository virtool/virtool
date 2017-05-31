/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobOptions
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSettings } from "../../actions";
import { InputSave } from "virtool/js/components/Base";


/**
 * A component the contains child components that modify options for resource limits on the server and on specific
 * tasks.
 */
const Resources = (props) => (
    <Row>
        <Col md={12}>
            <h5><strong>Resource Limits</strong></h5>
        </Col>
        <Col md={6}>
            <Panel>
                <InputSave
                    label="CPU Limit"
                    type="number"
                    onSave={(event) => props.onChangeProc("proc", event.value)}
                    initialValue={props.proc}
                />
                <InputSave
                    label="Memory Limit (GB)"
                    type="number"
                    onSave={(event) => props.onChangeMem("mem", event.value)}
                    initialValue={props.mem}
                />
            </Panel>
        </Col>
        <Col md={6}>
            <Panel>
                Set limits on the computing resources Virtool can use on the host server.
            </Panel>
        </Col>
    </Row>
);

Resources.propTypes = {
    proc: React.PropTypes.number,
    mem: React.PropTypes.number,
    onChangeProc: React.PropTypes.func,
    onChangeMem: React.PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        proc: state.settings.data.proc,
        mem: state.settings.data.mem
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onChangeProc: (proc) => {
            dispatch(updateSettings({proc: proc}));
        },

        onChangeMem: (mem) => {
            dispatch(updateSettings({mem: mem}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Resources);

export default Container;
