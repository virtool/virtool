import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import styled from "styled-components";
import { Button } from "./index";

const StyledUploadBar = styled.div`
    align-items: stretch;
    display: flex;
    height: 38px;
    margin-bottom: 15px;

    & > div:first-child {
        align-items: center;
        background-color: ${props => (props.active ? props.theme.greyLightest : "transparent")};
        border: 1px solid ${props => (props.active ? props.theme.blue : props.theme.color.greyLight)};
        border-radius: ${props => props.theme.borderRadius.sm};
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        flex: 1 0 auto;
        justify-content: center;
        margin: 0;
    }

    & > button {
        flex: 0 0 auto;
        margin-left: 3px;
    }
`;

export const UploadBar = ({ message, onDrop }) => {
    const messageComponent = <span>{message && message.length ? message : "Drag file here to upload"}</span>;

    const handleDrop = useCallback(acceptedFiles => {
        onDrop(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragAccept, open } = useDropzone({ onDrop: handleDrop });

    const rootProps = getRootProps({
        onClick: e => e.stopPropagation()
    });

    return (
        <StyledUploadBar active={isDragAccept}>
            <div {...rootProps}>
                <input {...getInputProps()} />
                {messageComponent}
            </div>
            <Button color="blue" icon="upload" onClick={open}>
                Upload
            </Button>
        </StyledUploadBar>
    );
};
