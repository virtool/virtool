import React from "react";
import Dropzone from "react-dropzone";
import Request from "superagent";
import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

export default class ReadUploader extends React.Component {

    onDrop = (files) => {
        files.forEach(file => {
            dispatcher.db.samples.request("authorize_upload", {name: file.name, size: file.size })
                .success(data => {
                    Request.post("/upload/" + data.file_id)
                        .send(file)
                        .end();
                });
        });
    };

    handleClick = () => {
        this.dropzone.open();
    };

    render () {

        const dropZoneStyle = {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            height: "34px",
            width: "100%",
            border: "1px solid #cccccc"
        };

        return (
            <Flex>
                <FlexItem grow={1}>
                    <Dropzone ref={(dropzone) => this.dropzone = dropzone} onDrop={this.onDrop} style={dropZoneStyle}>
                        <Flex justifyContent="center" alignItems="center">
                            <FlexItem>
                                Drag here to upload
                            </FlexItem>
                        </Flex>
                    </Dropzone>
                </FlexItem>

                <FlexItem grow={0} pad>
                    <Button onClick={this.handleClick}>
                        <Icon name="folder-open" />
                    </Button>
                </FlexItem>
            </Flex>
        );
    }
}
