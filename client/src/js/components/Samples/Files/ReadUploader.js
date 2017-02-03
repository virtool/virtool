import React from "react";
import Dropzone from "react-dropzone";
import Request from "superagent";
import { Flex, Icon, Button } from "virtool/js/components/Base";

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

    render = () => (
        <Flex>
            <Dropzone
                ref={(node) => this.dropzone = node}
                onDrop={this.onDrop}
                className="dropzone"
                activeClassName="dropzone-active"
                disableClick
            >
                Drag here to upload
            </Dropzone>

            <Button style={{marginLeft: "3px"}} onClick={() => this.dropzone.open()}>
                <Icon name="folder-open" />
            </Button>
        </Flex>
    );
}
