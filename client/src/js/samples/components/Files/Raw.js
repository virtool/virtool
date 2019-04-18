import { map, snakeCase } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { ListGroup, Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { replaceLegacyFiles } from "../../actions";
import { getIsReadyToReplace } from "../../selectors";
import { Icon } from "../../../base";
import SampleRawItem from "./RawItem";

const SampleFilesRawHeader = styled(Panel.Heading)`
    display: flex;
    justify-content: space-between;

    & > a {
        cursor: pointer;
    }
`;

export const SampleFilesRaw = ({ id, files, isReadyToReplace, prefix }) => {
    const fileComponents = map(files, (file, index) => (
        <SampleRawItem key={file.name} {...file} prefix={prefix} suffix={index + 1} />
    ));

    let replaceLink;

    if (isReadyToReplace) {
        replaceLink = (
            <a onClick={() => console.log(id)}>
                <Icon name="exchange" /> Redo
            </a>
        );
    }

    return (
        <Panel>
            <SampleFilesRawHeader>
                <strong>Raw Data</strong>
                {replaceLink}
            </SampleFilesRawHeader>
            <ListGroup>{fileComponents}</ListGroup>
        </Panel>
    );
};

const mapStateToProps = state => {
    const { id, files, name } = state.samples.detail;
    return {
        files,
        id,
        prefix: snakeCase(name),
        isReadyToReplace: getIsReadyToReplace(state)
    };
};

const mapDispatchToProps = dispatch => ({
    onReplace: id => {
        dispatch(replaceLegacyFiles(id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleFilesRaw);
