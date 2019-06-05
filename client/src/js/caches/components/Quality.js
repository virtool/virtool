import React from "react";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import { Quality } from "../../quality/components/Quality";

export const CacheQuality = props => (
    <Panel>
        <Panel.Heading>Quality</Panel.Heading>
        <Panel.Body>
            <Quality {...props} />
        </Panel.Body>
    </Panel>
);

const mapStateToProps = state => {
    const { bases, composition, sequences } = state.caches.detail.quality;
    return { bases, composition, sequences };
};

export default connect(mapStateToProps)(CacheQuality);
