/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Start
 */

import React from "react";
import Main from "virtool/js/components/Main";

const getInitialState = () => ({
    checkedSetup: false,
    needsSetup: false
});

export default class Start extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    render () {
        return <Main />;
    }

}
