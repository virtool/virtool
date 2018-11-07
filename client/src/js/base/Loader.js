import React from "react";

const getStyle = ({ color, size, style }) => ({
    ...style,
    width: size,
    height: size,
    borderColor: color
});

export const Loader = ({ color = "#3c8786", size = "22px", style = {} }) => (
    <div className="loader" style={getStyle({ color, size })}>
        <div />
    </div>
);
