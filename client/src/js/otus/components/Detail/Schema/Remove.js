import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { reject } from "lodash-es";
import { RemoveModal } from "../../../../base";

export const RemoveSegment = ({ activeName, schema, show, onHide, onSubmit }) => {
    const handleSubmit = useCallback(() => {
        onSubmit(reject(schema, { name: activeName }));
    }, [activeName]);

    return <RemoveModal name={activeName} noun="Segment" onConfirm={handleSubmit} onHide={onHide} show={show} />;
};

RemoveSegment.propTypes = {
    activeName: PropTypes.string,
    schema: PropTypes.arrayOf(PropTypes.object),
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func,
    onSubmit: PropTypes.func
};

export const mapStateToProps = state => ({
    schema: state.otus.detail.schema
});

export default connect(mapStateToProps)(RemoveSegment);
