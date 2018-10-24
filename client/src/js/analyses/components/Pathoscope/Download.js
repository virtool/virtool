/*  Helper functions to enable svg to png conversion and file download
 */
export const createBlob = svgNode => {
  const doctype =
    "<?xml version='1.0' standalone='no'?>" +
    "<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'>";

  const svg = new window.XMLSerializer().serializeToString(svgNode);
  const blob = new window.Blob([doctype + svg], {
    type: "image/svg+xml;charset=utf-8"
  });

  return window.URL.createObjectURL(blob);
};

export const formatSvg = (svg, setting) => {
  if (setting === "hidden") {
    svg
      .select("path")
      .node()
      .setAttribute("fill", "#428bca");
  }

  // eslint-disable-next-line
    svg.selectAll("text")
    .filter(".coverage-label")
    .node()
    .setAttribute("visibility", setting);

  // eslint-disable-next-line
    svg.selectAll("text")
    .filter(".download-overlay")
    .node()
    .setAttribute("visibility", setting);
};

export const getSvgAttr = svg => {
  const width = svg.attr("width");
  const height = svg.attr("height");

  // eslint-disable-next-line
    const filename = svg.selectAll("text")
    .filter(".coverage-label")
    .text();

  return {
    width,
    height,
    filename
  };
};

export const createImage = (width, height, url) => {
  const img = document.createElement("img");
  img.width = width;
  img.height = height;
  img.src = url;

  return img;
};

const drawBackground = (ctx, width, height) => {
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.fillStyle = "white";

  // eslint-disable-next-line
    ctx.fill();
};

export const createCanvas = (width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  return {
    ctx,
    canvas
  };
};

export const convertSvgToPng = (width, height, img) => {
  const { ctx, canvas } = createCanvas(width, height);

  drawBackground(ctx, width, height);

  ctx.drawImage(img, 0, 0);
  const canvasUrl = canvas.toDataURL("image/png");
  const canvasImg = document.createElement("img");
  canvasImg.width = width;
  canvasImg.height = height;
  canvasImg.src = canvasUrl;

  return canvasUrl;
};

export const downloadPng = (filename, canvasUrl) => {
  const a = document.createElement("a");
  a.href = canvasUrl;
  a.download = filename;

  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const getPng = svgAttr => {
  const { width, height, url, filename } = svgAttr;

  const img = createImage(width, height, url);

  img.onload = function() {
    const canvasUrl = convertSvgToPng(width, height, this);
    downloadPng(filename, canvasUrl);
  };
};
