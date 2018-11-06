import React from "react";
import { map } from "lodash-es";
import { ListGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { Button, Flex, FlexItem, Icon } from "../../base";
import Install from "./Install";
import Release from "./Release";

export const Releases = ({ onShowInstall, releases }) => {
    if (releases.length) {
        const releaseComponents = map(releases, release => <Release key={release.name} {...release} />);

        return (
            <Panel>
                <Panel.Body style={{ padding: "10px 15px" }}>
                    <Flex alignItems="center">
                        <FlexItem grow={1} shrink={0}>
                            <strong className="text-warning">
                                <Icon name="arrow-alt-circle-up" /> Update
                                {releases.length === 1 ? "" : "s"} Available
                            </strong>
                        </FlexItem>
                        <FlexItem grow={0} shrink={0} pad={15}>
                            <Button icon="download" bsStyle="primary" onClick={onShowInstall}>
                                Install
                            </Button>
                        </FlexItem>
                    </Flex>
                </Panel.Body>
                <ListGroup>{releaseComponents}</ListGroup>

                <Install />
            </Panel>
        );
    }

    return (
        <Panel>
            <Panel.Body style={{ padding: "10px 15px" }}>
                <Icon bsStyle="success" name="check" />
                <strong className="text-success"> Software is up-to-date</strong>
            </Panel.Body>
        </Panel>
    );
};

const mapStateToProps = state => ({
    releases: state.updates.releases
});

const mapDispatchToProps = dispatch => ({
    onShowInstall: () => {
        dispatch(push({ state: { install: true } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Releases);
