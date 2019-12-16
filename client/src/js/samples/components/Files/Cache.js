import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup, BoxGroupHeader, NoneFoundSection } from "../../../base";
import SampleCacheItem from "./CacheItem";

export const SampleFilesCache = ({ caches }) => {
    let fileComponents;

    if (caches && caches.length) {
        fileComponents = map(caches, ({ created_at, files, hash, id, missing }) => (
            <SampleCacheItem key={id} createdAt={created_at} files={files} hash={hash} id={id} missing={missing} />
        ));
    } else {
        fileComponents = <NoneFoundSection key="none" noun="cached trims" />;
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>Cached Trims</h2>
                <p>Trimmed reads saved from analysis runs that can be reused in future analyses.</p>
            </BoxGroupHeader>
            {fileComponents}
        </BoxGroup>
    );
};

export const mapStateToProps = state => ({
    caches: state.samples.detail.caches
});

export default connect(mapStateToProps)(SampleFilesCache);
