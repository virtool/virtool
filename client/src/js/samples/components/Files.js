import React, { PropTypes } from "react";
import { connect } from "react-redux";

import { findFiles } from "../../files/actions";
import { Uploader } from "virtool/js/components/Base";

class ReadFiles extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        onFind: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind();
    }

    render () {
        if (this.props.documents === null) {
            return <div />;
        }

        return <Uploader fileDocuments={this.state.documents} onDrop={this.upload} onRemove={this.remove}/>;
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.files.documents
    };
};

const mapDispatchProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findFiles());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchProps)(ReadFiles);

export default Container;
