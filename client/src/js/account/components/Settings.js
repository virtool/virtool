import React from "react";
import { connect } from "react-redux";
import { Panel, ListGroup, ListGroupItem, Row, Col } from "react-bootstrap";

import { updateAccountSettings } from "../actions";
import { Checkbox, Flex, FlexItem } from "../../base";

const AccountSettings = props => {
    const settings = props.account.settings;

    return (
        <div>
            <Row>
                <Col md={8} lg={6}>
                    <Panel>
                        <Panel.Heading>User Interface</Panel.Heading>
                        <Panel.Body>
                            <ListGroup>
                                <ListGroupItem>
                                    <Flex>
                                        <FlexItem>
                                            <Checkbox
                                                checked={settings.show_ids}
                                                onClick={() => props.onUpdateSetting("show_ids", !settings.show_ids)}
                                            />
                                        </FlexItem>
                                        <FlexItem pad={10}>
                                            <div>Show Unique ID Fields</div>
                                            <small>
                                                Show the unique database IDs for Virtool records where possible. This is
                                                not required for normal use, but is useful for debugging.
                                            </small>
                                        </FlexItem>
                                    </Flex>
                                </ListGroupItem>
                            </ListGroup>
                        </Panel.Body>
                    </Panel>
                </Col>
            </Row>
        </div>
    );
};

const mapStateToProps = state => ({
    account: state.account
});

const mapDispatchToProps = dispatch => ({
    onUpdateSetting: (key, value) => {
        const update = {};
        update[key] = value;
        dispatch(updateAccountSettings(update));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AccountSettings);
