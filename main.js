const { entrypoints } = require("uxp");
const { app, core, constants, imaging } = require("photoshop");

entrypoints.setup({
    // commands: {
    //     analyze,
    // },
    panels: {
        analyze_pannel: {
          show(node ) {
          }
        }
      }  
  });

document.getElementById("btnAnalyzeAndSelect").addEventListener("click", () => {analyze_with_try_catch()});

async function analyze_with_try_catch() {
    try {
        await analyze();
    } catch (e) {
        console.log("analyze error", e);
        app.showAlert(`analyze error ${e}`);
    }
}

async function analyze() {

    maxNumberOfColors = document.getElementById("inputMaxColorsInImage").value;

    const doc = app.activeDocument;
    if (!doc) {
        return app.showAlert("No document is open.");
    }

    const layer = doc.activeLayers[0];
    if (!layer) {
        return app.showAlert("Please select a layer.");
    }

    console.log(doc.mode)
    if (doc.mode === "indexedColorMode") {
        return app.showAlert("This does not work in indexed color mode. Please convert to RGB mode.");
    }
    
    const pixels = await getLayerPixelData(layer);
    if (!pixels) {
        return app.showAlert("Could not retrieve pixel data from the layer.");
    }

    const violations = findColorViolations(pixels, doc.width);
    const numColor = getNumColor(pixels);

    if (violations.length === 0 && numColor <= maxNumberOfColors) {
        return app.showAlert("No violations found.");
    }

    if (violations.length > 0){
        try {
            await selectViolationAreas(violations);
        } catch (e) {
            console.error("selectViolationAreas error", e);
            throw e;
        }
    }

    message = `There are ${violations.length} violations.`;
    if (numColor > maxNumberOfColors) {
        message += ` Additionally, there are ${numColor} colors, exceeding the limit of ${maxNumberOfColors} colors.`;
    }
    return app.showAlert(message);

}

async function getLayerPixelData(layer) {
    return core.executeAsModal(async () => {
        const imaging = require("photoshop").imaging;
        /* getPixels returns error when image is color mode 2 (index color) */
        const imageObj = await imaging.getPixels({
            documentID: app.activeDocument.id,
            layerID: layer.id
        });
        return imageObj.imageData.getData();
    }, { commandName: "Get Pixel Data" });
}

function findColorViolations(pixels, width) {
    const height = pixels.length / (width * 4);
    let violations = [];
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x += 8) {
            let colors = new Set();
            for (let dx = 0; dx < Math.min(8, width - x); dx++) {
                const index = ((y * width) + (x + dx)) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                colors.add(`${r},${g},${b}`);
            }
            if (colors.size > 2) {
                violations.push({ x, y });
            }
        }
    }
    return violations;
}

function getNumColor(pixels) {
    let colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        colors.add(`${r},${g},${b}`);
    }
    return colors.size;
}

async function selectViolationAreas(violations) {
    
    await core.executeAsModal(async () => {
        const doc = app.activeDocument;        
        let cnt = -1;
        for (const { x, y } of violations) {
            cnt += 1;
            try {
                selectionType = cnt == 0 ? constants.SelectionType.REPLACE: constants.SelectionType.EXTEND;
                // const selectionRegions = violations.map(({ x, y }) => ({
                //     top: y,
                //     left: x,
                //     bottom: y + 1,
                //     right: Math.min(x + 8, doc.width)
                // }));
                await doc.selection.selectRectangle(
                    { top: y, left: x, bottom: y + 1, right: Math.min(x + 8, doc.width) },
                    selectionType, 0, false
                );
            } catch (e) {
                console.log("selectRectangle error", e);
            }
        }
    }, { commandName: "Select Violation Areas" });
}

