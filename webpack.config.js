const path = require("path");

/** @type {import('webpack').Configuration} */
const config = {
  target: "node",
  mode: "development", // Установка режима сборки
  entry: "./src/extension.ts", // Убедитесь, что здесь не указаны тестовые файлы
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode", // Игнорируем модуль vscode
    mocha: "commonjs mocha", // Игнорируем модуль mocha
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
    ],
  },
  devtool: "source-map",
};
module.exports = config;
