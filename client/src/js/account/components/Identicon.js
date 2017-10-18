/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";

const hsl2rgb = (h, s, b) => {
    h *= 6;
    s = [
        b += s *= b < .5 ? b : 1 - b,
        b - h % 1 * s * 2,
        b -= s *= 2,
        b,
        b + h % 1 * s,
        b + s
    ];

    return[
        Math.floor(s[ ~~h    % 6 ] * 255), // red
        Math.floor(s[ (h|16) % 6 ] * 255), // green
        Math.floor(s[ (h|8)  % 6 ] * 255),  // blue
        255
    ];
};

const Identicon = ({ hash }) => {

    const size = 64;
    const cell = Math.floor(64 / 5);

    const hue = parseInt(hash.substr(-7), 16) / 0xfffffff;
    const saturation = 0.7;
    const brightness = 0.5;

    let foreground = hsl2rgb(saturation, brightness, hue);
    let background = [240, 240, 240, 255];

    foreground = `rgba(${foreground.join(",")})`;
    background = `rgba(${background.join(",")})`;

    let rectPropsArray = [];

    for (let i = 0; i < 15; i++) {
        const color = parseInt(hash.charAt(i), 16) % 2 ? background: foreground;

        if (i < 5) {
            rectPropsArray.push({key: i, x: 2 * cell, y: i * cell, fill: color});
        } else if (i < 10) {
            const y = (i - 5) * cell;
            rectPropsArray.push({key: `${i}_0`, x: cell, y, fill: color});
            rectPropsArray.push({key: `${i}_1`, x: 3 * cell, y, fill: color});
        } else if (i < 15) {
            const y = (i - 10) * cell;
            rectPropsArray.push({key: `${i}_0`, x: 0, y, fill: color});
            rectPropsArray.push({key: `${i}_1`, x: 4 * cell, y, fill: color});
        }
    }

    return (
        <svg width={size} height={size}>
            {rectPropsArray.map(rectProps => <rect height={cell} width={cell} {...rectProps} />)}
        </svg>
    );
};

export default Identicon;
