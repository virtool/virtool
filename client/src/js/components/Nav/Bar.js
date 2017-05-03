/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Bar
 */

import React from "react";
import ChildBar from "./Child/Bar";
import ParentBar from "./Parent/Bar";

/**
 * A container component that renders the primary and secondary navigation bars.
 */
const Bar = () => (
    <div>
        <ParentBar />
        <ChildBar />
    </div>
);

export default Bar;
