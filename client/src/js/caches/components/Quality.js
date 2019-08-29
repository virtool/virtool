import React from "react";
import { connect } from "react-redux";
import { Quality } from "../../quality/components/Quality";
import { Panel } from "../../base";

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
