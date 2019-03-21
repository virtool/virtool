var path = require("path");
var HTMLPlugin = require("html-webpack-plugin");
var CleanWebpackPlugin = require("clean-webpack-plugin");
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: "./src/js/index.js",

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: [
          "babel-loader",
          {
            loader: "eslint-loader",
            options: {
              fix: true,
              configFile: path.resolve(__dirname, "./.eslintrc")
            }
          }
        ]
      },

      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: "css-loader"
        })
      },

      {
        test: /\.less$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: [{ loader: "css-loader" }, { loader: "less-loader" }]
        })
      },

      {
        test: /\.(woff|woff2)$/,
        use: {
          loader: "url-loader?limit=100000"
        }
      }
    ]
  },

  node: {
    fs: "empty"
  },

  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "app.[hash:8].js",
    publicPath: "/static/"
  },

  mode: "development",

  plugins: [
    new ExtractTextPlugin("style.[hash:8].css"),

    new HTMLPlugin({
      filename: "index.html",
      title: "Virtool",
      favicon: "./src/images/favicon.ico",
      template: "./src/index.html",
      inject: "body"
    }),

    new CleanWebpackPlugin({
      dry: false,
      verbose: false,
      cleanStaleWebpackAssets: true,
      protectWebpackAssets: true,
      dangerouslyAllowCleanPatternsOutsideProject: false
    })
  ],

  watch: true
};
