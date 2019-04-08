import { map } from "lodash-es";
import React from "react";
import { ListGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { NoneFound } from "../../../base";
import SampleCacheItem from "./CacheItem";

export const SampleFilesCache = ({ caches }) => {
    let fileComponents;

    if (caches && caches.length) {
        fileComponents = map(caches, cache => <SampleCacheItem key={cache.id} {...cache} />);
    } else {
        fileComponents = <NoneFound key="none" noun="cached trims" noListGroup />;
    }

    return (
        <Panel>
            <Panel.Heading>Cached Trims</Panel.Heading>
            <ListGroup>{fileComponents}</ListGroup>
        </Panel>
    );
};

const mapStateToProps = state => ({
    caches: state.samples.detail.caches
});

export default connect(mapStateToProps)(SampleFilesCache);
