import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const cjsDir = join(root, "node_modules/react-server-dom-webpack/cjs");

const serverBundles = [
  "react-server-dom-webpack-server.browser.development.js",
  "react-server-dom-webpack-server.browser.production.js",
  "react-server-dom-webpack-server.edge.development.js",
  "react-server-dom-webpack-server.edge.production.js",
  "react-server-dom-webpack-server.node.development.js",
  "react-server-dom-webpack-server.node.production.js",
];

const clientBundles = [
  "react-server-dom-webpack-client.browser.development.js",
  "react-server-dom-webpack-client.browser.production.js",
  "react-server-dom-webpack-client.edge.development.js",
  "react-server-dom-webpack-client.edge.production.js",
  "react-server-dom-webpack-client.node.development.js",
  "react-server-dom-webpack-client.node.production.js",
];

if (!existsSync(cjsDir)) {
  console.warn(
    "Skipping React RSC null-prototype patch: react-server-dom-webpack is not installed.",
  );
  process.exit(0);
}

let patchedFiles = 0;

for (const fileName of serverBundles) {
  patchBundle(fileName, (source) =>
    fileName.includes(".production.")
      ? patchProductionServer(source, fileName)
      : patchDevelopmentServer(source, fileName),
  );
}

for (const fileName of clientBundles) {
  patchBundle(fileName, (source) =>
    fileName.includes(".production.")
      ? patchProductionClient(source, fileName)
      : patchDevelopmentClient(source, fileName),
  );
}

if (patchedFiles > 0) {
  console.log(`Patched ${patchedFiles} react-server-dom-webpack bundle(s).`);
}

function patchBundle(fileName, patcher) {
  const filePath = join(cjsDir, fileName);
  if (!existsSync(filePath)) {
    throw new Error(
      `Expected ${fileName} to exist in react-server-dom-webpack.`,
    );
  }

  const source = readFileSync(filePath, "utf8");
  const updated = patcher(source);
  if (updated !== source) {
    writeFileSync(filePath, updated);
    patchedFiles++;
  }
}

function patchDevelopmentServer(source, fileName) {
  if (
    source.includes("function serializeNullPrototypeObject(request, object)")
  ) {
    return source;
  }

  let updated = replaceOnce(
    source,
    `    function serializeSet(request, set) {
      set = Array.from(set);
      return "$W" + outlineModel(request, set).toString(16);
    }
`,
    `    function serializeSet(request, set) {
      set = Array.from(set);
      return "$W" + outlineModel(request, set).toString(16);
    }
    function serializeNullPrototypeObject(request, object) {
      var entries = [],
        key;
      for (key in object)
        hasOwnProperty.call(object, key) && entries.push([key, object[key]]);
      return "$p" + outlineModel(request, entries).toString(16);
    }
`,
    fileName,
  );

  updated = replaceOnce(
    updated,
    `        elementReference = getPrototypeOf(value);
        if (
          elementReference !== ObjectPrototype$1 &&
          (null === elementReference ||
            null !== getPrototypeOf(elementReference))
        )
`,
    `        elementReference = getPrototypeOf(value);
        if (null === elementReference)
          return serializeNullPrototypeObject(request, value);
        if (
          elementReference !== ObjectPrototype$1 &&
          null !== getPrototypeOf(elementReference)
        )
`,
    fileName,
  );

  return updated;
}

function patchProductionServer(source, fileName) {
  if (
    source.includes("function serializeNullPrototypeObject(request, object)")
  ) {
    return source;
  }

  let updated = replaceOnce(
    source,
    `function serializeTypedArray(request, tag, typedArray) {
  request.pendingChunks++;
  var bufferId = request.nextChunkId++;
  emitTypedArrayChunk(request, bufferId, tag, typedArray, !1);
  return serializeByValueID(bufferId);
}
`,
    `function serializeTypedArray(request, tag, typedArray) {
  request.pendingChunks++;
  var bufferId = request.nextChunkId++;
  emitTypedArrayChunk(request, bufferId, tag, typedArray, !1);
  return serializeByValueID(bufferId);
}
function serializeNullPrototypeObject(request, object) {
  var entries = [],
    key;
  for (key in object)
    hasOwnProperty.call(object, key) && entries.push([key, object[key]]);
  return "$p" + outlineModelWithFormatContext(request, entries, 0).toString(16);
}
`,
    fileName,
  );

  updated = replaceOnce(
    updated,
    `    if (value instanceof Date) return "$D" + value.toJSON();
    request = getPrototypeOf(value);
`,
    `    if (value instanceof Date) return "$D" + value.toJSON();
    if (null === getPrototypeOf(value))
      return serializeNullPrototypeObject(request, value);
    request = getPrototypeOf(value);
`,
    fileName,
  );

  return updated;
}

function patchDevelopmentClient(source, fileName) {
  if (source.includes("function createNullPrototypeObject(response, model)")) {
    return source;
  }

  let updated = replaceOnce(
    source,
    `    function createSet(response, model) {
      return new Set(model);
    }
`,
    `    function createSet(response, model) {
      return new Set(model);
    }
    function createNullPrototypeObject(response, model) {
      response = Object.create(null);
      for (var i = 0; i < model.length; i++) {
        var entry = model[i];
        response[entry[0]] = entry[1];
      }
      return response;
    }
`,
    fileName,
  );

  updated = replaceOnce(
    updated,
    `          case "W":
            return (
              (ref = value.slice(2)),
              getOutlinedModel(response, ref, parentObject, key, createSet)
            );
`,
    `          case "W":
            return (
              (ref = value.slice(2)),
              getOutlinedModel(response, ref, parentObject, key, createSet)
            );
          case "p":
            return (
              (ref = value.slice(2)),
              getOutlinedModel(
                response,
                ref,
                parentObject,
                key,
                createNullPrototypeObject
              )
            );
`,
    fileName,
  );

  return updated;
}

function patchProductionClient(source, fileName) {
  if (source.includes("function createNullPrototypeObject(response, model)")) {
    return source;
  }

  let updated = replaceOnce(
    source,
    `function createSet(response, model) {
  return new Set(model);
}
`,
    `function createSet(response, model) {
  return new Set(model);
}
function createNullPrototypeObject(response, model) {
  response = Object.create(null);
  for (var i = 0; i < model.length; i++) {
    var entry = model[i];
    response[entry[0]] = entry[1];
  }
  return response;
}
`,
    fileName,
  );

  updated = replaceOnce(
    updated,
    `      case "W":
        return (
          (value = value.slice(2)),
          getOutlinedModel(response, value, parentObject, key, createSet)
        );
`,
    `      case "W":
        return (
          (value = value.slice(2)),
          getOutlinedModel(response, value, parentObject, key, createSet)
        );
      case "p":
        return (
          (value = value.slice(2)),
          getOutlinedModel(
            response,
            value,
            parentObject,
            key,
            createNullPrototypeObject
          )
        );
`,
    fileName,
  );

  return updated;
}

function replaceOnce(source, search, replacement, fileName) {
  const first = source.indexOf(search);
  if (first === -1) {
    throw new Error(`Could not patch ${fileName}: expected pattern not found.`);
  }

  const second = source.indexOf(search, first + search.length);
  if (second !== -1) {
    throw new Error(`Could not patch ${fileName}: pattern matched twice.`);
  }

  return (
    source.slice(0, first) + replacement + source.slice(first + search.length)
  );
}
