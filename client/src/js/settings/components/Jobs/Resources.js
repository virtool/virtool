import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { InputError } from "../../../base";


const Resources = (props) => (
    <Row>
        <Col md={12}>
            <h5><strong>Resource Limits</strong></h5>
        </Col>
        <Col xs={12} md={6} mdPush={6}>
            <Panel>
                Set limits on the computing resources Virtool can use on the host server.
            </Panel>
        </Col>
        <Col xs={12} md={6} mdPull={6}>
            <Panel>
                <InputError
                    label="CPU Limit"
                    type="number"
                    onSave={props.onUpdateProc}
                    initialValue={props.proc}
                    withButton
                />
                <InputError
                    label="Memory Limit (GB)"
                    type="number"
                    onSave={props.onUpdateMem}
                    initialValue={props.mem}
                    withButton
                />
            </Panel>
        </Col>
    </Row>
);

const mapStateToProps = (state) => ({
    proc: state.settings.data.proc,
    mem: state.settings.data.mem
});

const mapDispatchToProps = (dispatch) => ({

    onUpdateProc: (e) => {
        dispatch(updateSetting("proc", e.value));
    },

    onUpdateMem: (e) => {
        dispatch(updateSetting("mem", e.value));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(Resources);

export default Container;
