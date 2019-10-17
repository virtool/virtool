import React from "react";
import { connect } from "react-redux";
import { Quality } from "../../quality/components/Quality";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../base";

export const CacheQuality = props => (
    <BoxGroup>
        <BoxGroupHeader>Quality</BoxGroupHeader>
        <BoxGroupSection>
            <Quality {...props} />
        </BoxGroupSection>
    </BoxGroup>
);

export const mapStateToProps = state => {
    const { bases, composition, sequences } = state.caches.detail.quality;
    return { bases, composition, sequences };
};

export default connect(mapStateToProps)(CacheQuality);
