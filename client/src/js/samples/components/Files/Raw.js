import { map, snakeCase } from "lodash-es";
import React from "react";
import { ListGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import SampleRawItem from "./RawItem";

export const SampleFilesRaw = ({ files, prefix }) => {
    const fileComponents = map(files, (file, index) => (
        <SampleRawItem key={file.name} {...file} prefix={prefix} suffix={index + 1} />
    ));

    return (
        <Panel>
            <Panel.Heading>Raw Data</Panel.Heading>
            <ListGroup>{fileComponents}</ListGroup>
        </Panel>
    );
};

const mapStateToProps = state => ({
    files: state.samples.detail.files,
    sampleName: snakeCase(state.samples.detail.name)
});

export default connect(mapStateToProps)(SampleFilesRaw);
