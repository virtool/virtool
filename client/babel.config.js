module.exports = {
  plugins: [
    ["@babel/plugin-proposal-class-properties"],
    ["@babel/plugin-transform-runtime", { regenerator: true }],
    ["babel-plugin-styled-components", { displayName: true }]
  ],

  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current",
          chrome: "60",
          firefox: "53",
          safari: "12",
          edge: "40"
        }
      }
    ],
    ["@babel/preset-react"]
  ]
};
