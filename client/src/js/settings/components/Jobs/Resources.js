import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { InputSave } from "../../../base";


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
                <InputSave
                    label="CPU Limit"
                    type="number"
                    onSave={(event) => props.onUpdateProc(event.value)}
                    initialValue={props.proc}
                />
                <InputSave
                    label="Memory Limit (GB)"
                    type="number"
                    onSave={(event) => props.onUpdateMem(event.value)}
                    initialValue={props.mem}
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

    onUpdateProc: (value) => {
        dispatch(updateSetting("proc", value));
    },

    onUpdateMem: (value) => {
        dispatch(updateSetting("mem", value));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(Resources);

export default Container;
