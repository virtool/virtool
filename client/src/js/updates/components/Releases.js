import React from "react";
import { get, map } from "lodash-es";
import { ListGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";

import Release from "./Release";
import { Icon } from "../../base";

export const Releases = ({ releases }) => {
    if (releases && releases.length) {
        const releaseComponents = map(releases, release =>
            <Release key={release.name} {...release} />
        );

        return (
            <Panel>
                <ListGroup>
                    {releaseComponents}
                </ListGroup>
            </Panel>
        );
    }

    return (
        <Panel>
            <Panel.Body>
                <Icon bsStyle="success" name="check"/>
                <strong className="text-success"> Software is up-to-date</strong>
            </Panel.Body>
        </Panel>
    );
};

const mapStateToProps = (state) => ({
    releases: get(state, "updates.releases")
});

export default connect(mapStateToProps)(Releases);
