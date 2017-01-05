import React from "react";
import Dropzone from "react-dropzone";
import Request from "superagent";
import { Flex, Icon, Button } from "virtool/js/components/Base";

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
        this.refs.dropzone.open();
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
                <Flex.Item grow={1}>
                    <Dropzone ref="dropzone" onDrop={this.onDrop} style={dropZoneStyle}>
                        <Flex justifyContent="center" alignItems="center">
                            <Flex.Item>
                                Drag here to upload
                            </Flex.Item>
                        </Flex>
                    </Dropzone>
                </Flex.Item>

                <Flex.Item grow={0} pad>
                    <Button onClick={this.handleClick}>
                        <Icon name="folder-open" />
                    </Button>
                </Flex.Item>
            </Flex>
        );
    }
}
