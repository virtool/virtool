import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Button, Icon, Checkbox } from "../../../base";

const SentryFooter = () => (
    <small className="text-warning">
        <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
    </small>
);

const SentryOptions = ({ enabled, onToggle }) => (
    <div>
        <Row>
            <Col xs={12}>
                <label>Sentry</label>
            </Col>
        </Row>
        <Row>
            <Col xs={12} md={4} mdPush={4}>
                <Panel>
                    <Panel.Body>
                        Enable or disable Sentry error reporting.
                         Error reporting allows the developers to prevent future errors.
                    </Panel.Body>
                    <Panel.Footer>
                        <SentryFooter />
                    </Panel.Footer>
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
    enabled: state.settings.data.enable_sentry
});

const mapDispatchToProps = (dispatch) => ({

    onToggle: (value) => {
        dispatch(updateSetting("enable_sentry", value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SentryOptions);
