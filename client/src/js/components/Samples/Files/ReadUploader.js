import React from "react";
import Dropzone from "react-dropzone";
import Request from "superagent";
import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

export default class ReadUploader extends React.Component {

    onDrop = (files) => {
        files.forEach(file => {
            dispatcher.db.samples.request("authorize_upload", {name: file.name, size: file.size })
                .success(data => {
                    Request.post(`/upload/${data.file_id}`)
                        .send(file)
                        .end();
                });
        });
    };

    handleClick = () => this.dropzone.open();

    render = () => (
        <Flex>
            <Dropzone
                ref={(node) => this.dropzone = node}
                onDrop={this.onDrop}
                className="dropzone"
                activeClassName="dropzone-active"
                disableClick>
                <Flex justifyContent="center" alignItems="center">
                    <FlexItem>
                        Drag here to upload
                    </FlexItem>
                </Flex>
            </Dropzone>

            <Button style={{marginLeft: "3px"}} onClick={this.handleClick}>
                <Icon name="folder-open" />
            </Button>
        </Flex>
    );
}
