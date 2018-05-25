import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Checkbox, Button } from "../../../base";

const UniqueNames = ({ enabled, onToggle }) => (
    <div>
        <Row>
            <Col md={12}>
                <h5><strong>Unique Sample Names</strong></h5>
            </Col>
            <Col xs={12} md={4} mdPush={4}>
                <Panel>
                    <Panel.Body>
                        Enable this feature to ensure that every created sample has a unique name. If a user
                        attempts to assign an existing name to a new sample an error will be displayed.
                    </Panel.Body>
                </Panel>
            </Col>
            <Col xs={12} md={4} mdPull={4}>
                <Panel>
                    <Panel.Body>
                        <Button onClick={() => {onToggle(!enabled)}} block>
                            <Checkbox checked={enabled} /> Enable
                        </Button>
                    </Panel.Body>
                </Panel>
            </Col>
        </Row>
    </div>
);

const mapStateToProps = (state) => ({
    enabled: state.settings.data.sample_unique_names
});

const mapDispatchToProps = (dispatch) => ({

    onToggle: (value) => {
        dispatch(updateSetting("sample_unique_names", value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(UniqueNames);
