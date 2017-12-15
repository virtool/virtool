/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveSample
 */

import React from "react";
import { connect } from "react-redux";

import { removeSample, hideSampleModal } from "../actions";
import { RemoveModal } from "../../base";

const RemoveSample = ({ id, name, show, onHide, onConfirm }) => (
    <RemoveModal
        noun="Virus"
        name={name}
        show={show}
        onConfirm={() => onConfirm(id)}
        onHide={onHide}
    />
);

const mapStateToProps = (state) => {
    return {
        show: state.samples.showRemove
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideSampleModal());
        },

        onConfirm: (sampleId) => {
            dispatch(removeSample(sampleId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveSample);

export default Container;
