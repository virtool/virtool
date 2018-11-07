import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { reject } from "lodash-es";
import { RemoveModal } from "../../../base";

class RemoveSegment extends React.Component {
    handleSubmit = () => {
        let newArray = this.props.schema.slice();
        newArray = reject(newArray, ["name", this.props.curSeg.name]);
        this.props.onSubmit(newArray);
    };

    render() {
        return (
            <RemoveModal
                name={this.props.curSeg.name}
                noun="Segment"
                onConfirm={this.handleSubmit}
                onHide={this.props.onHide}
                show={this.props.show}
            />
        );
    }
}

RemoveSegment.propTypes = {
    schema: PropTypes.arrayOf(PropTypes.object),
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func,
    onSubmit: PropTypes.func,
    curSeg: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    schema: state.otus.detail.schema
});

export default connect(mapStateToProps)(RemoveSegment);
