import React from 'react';
import Dropzone from 'react-dropzone';

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');

export default class ReadFileList extends React.Component {

    static propTypes = {
        files: React.PropTypes.arrayOf(React.PropTypes.object)
    }

    render () {

        const fileComponents = this.props.files.map((file) => {
            return <p>{file.name}</p>
        });

        const dropZoneStyle = {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            height: "34px",
            width: "100%",
            border: "1px solid #cccccc"
        };

        return (
            <div>
                <Flex>
                    <Flex.Item grow={1}>
                        <Dropzone style={dropZoneStyle}>
                            <Flex justifyContent="center" alignItems="center">
                                <Flex.Item>
                                    Drag here to upload
                                </Flex.Item>
                            </Flex>
                        </Dropzone>
                    </Flex.Item>

                    <Flex.Item grow={0} pad={5}>
                        <Button>
                            <Icon name="folder-open" />
                        </Button>
                    </Flex.Item>
                </Flex>

                {fileComponents}
            </div>
        );
    }

}