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

document.getElementById("btnAnalyzeAndSelect").addEventListener("click", () => {analyze()});

async function analyze() {

    maxNumberOfColors = document.getElementById("inputNumberOfColors").value;

    const doc = app.activeDocument;
    console.log("analyze start");
    if (!doc) {
         app.showAlert("No document is open.");
        return;
    }

    const layer = doc.activeLayers[0];
    if (!layer) {
         app.showAlert("Please select a layer.");
        return;
    }
    
    const pixels = await getLayerPixelData(layer);
    if (!pixels) {
         app.showAlert("Could not retrieve pixel data from the layer.");
        return;
    }

    const violations = findColorViolations(pixels, doc.width);
    const numColor = getNumColor(pixels);

    if (violations.length === 0 && numColor <= maxNumberOfColors) {
         app.showAlert("No violations found.");
         return;
    }

    if (violations.length > 0){
        console.log("selectViolationAreas start");
        try {
            await selectViolationAreas(violations);
        } catch (e) {
            console.log("selectViolationAreas error", e);
        }
        console.log("selectViolationAreas end");    
    }

    message = `There are ${violations.length} violations.`;
    if (numColor > maxNumberOfColors) {
        message += ` Additionally, there are ${numColor} colors, exceeding the limit of ${maxNumberOfColors} colors.`;
    }
    app.showAlert(message);

}

async function getLayerPixelData(layer) {
    return core.executeAsModal(async () => {
        const imaging = require("photoshop").imaging;
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
            for (let dx = 0; dx < 8; dx++) {
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
            console.log("cnt", cnt);
            try {
                selectionType = cnt == 0 ? constants.SelectionType.REPLACE: constants.SelectionType.EXTEND;
                console.log("selectionType", selectionType);
                await doc.selection.selectRectangle(
                    { top: y, left: x, bottom: y + 1, right: x + 8 },
                    selectionType
                );
                console.log("selectRectangle", x, y);
            } catch (e) {
                console.log("selectRectangle error", e);
            }
        }
    }, { commandName: "Select Violation Areas" });
}

