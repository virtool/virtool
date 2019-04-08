import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button, Flex, FlexItem } from "./index";

export const UploadBar = ({ message, onDrop }) => {
    const messageComponent = <span>{message && message.length ? message : "Drag file here to upload"}</span>;

    const handleDrop = useCallback(acceptedFiles => {
        onDrop(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, open } = useDropzone({ onDrop: handleDrop });

    const rootProps = getRootProps({
        className: "dropzone",
        onClick: e => e.stopPropagation()
    });

    return (
        <Flex>
            <FlexItem grow={1}>
                <div {...rootProps}>
                    <input {...getInputProps()} />
                    {messageComponent}
                </div>
            </FlexItem>
            <FlexItem pad>
                <Button icon="upload" onClick={open}>
                    Upload
                </Button>
            </FlexItem>
        </Flex>
    );
};
