import { map, snakeCase } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader } from "../../../base";
import { ReadItem } from "./ReadItem";

const SampleReadsTitle = styled.h2`
    display: flex;
    justify-content: space-between;

    & > a {
        cursor: pointer;
    }
`;

export const SampleReads = ({ reads, prefix }) => {
    const fileComponents = map(reads, (file, index) => (
        <ReadItem key={file.name} {...file} prefix={prefix} suffix={index + 1} />
    ));

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <SampleReadsTitle>Reads</SampleReadsTitle>
                <p>The input sequencing data used to create this sample.</p>
            </BoxGroupHeader>
            {fileComponents}
        </BoxGroup>
    );
};

export const mapStateToProps = state => {
    const { id, reads, name } = state.samples.detail;
    return {
        reads,
        id,
        prefix: snakeCase(name)
    };
};

export default connect(mapStateToProps)(SampleReads);
