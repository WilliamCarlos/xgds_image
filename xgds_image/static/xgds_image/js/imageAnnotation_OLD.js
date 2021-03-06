/*

      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE
      TEST FILE PLEASE IGNORE

 */



// var xgds_image_annotation = xgds_image_annotation || {};
//
// $.extend(xgds_image_annotation, {
//     initialize: function (imageJson, osdViewer) {
//         //imageJson.pk is the pk of the image you want to work with now.
//         // if you were already initialized before, clear stuff
//         // set your pk to be imageJson.pk
//         this.imagePK = imageJson.pk;
//
//
//     }
// });
//
//
/
// var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
// var viewer = OpenSeadragon({
//     id: "openseadragon1",
//     prefixUrl: prefixUrl,
//     showNavigator: false,
//     gestureSettingsMouse: {
//         clickToZoom: false
//     },
//     clickToZoom: "false",
//     tileSources: [{
//         Image: {
//             //Need to change [tile_format="jpg", image_quality=0.85,]
//             //Plus any other changes in deepzoom.py we make
//             xmlns: "http://schemas.microsoft.com/deepzoom/2009",
//             Url: "../../../../data/images/spacePics/ISS044-E-1998_files/",
//             TileSize: "128",
//             Overlap: "2",
//             Format: "png",
//             ServerFormat: "Default",
//             Size: {
//                 Width: "4928",
//                 Height: "3280",
//             }
//         }
//     }],
// });
//
// //fabricjs-openseadragon annotation object
// var overlay = viewer.fabricjsOverlay();
// var arrow, line, rectangle, circle, ellipse, text, isDown, textboxPreview, origX, origY;
// var currentAnnotationType = "arrow"; //stores the type of the current annotation being drawn so we know which varaible (arrow/line/rectangle/ellipse/text etc) to serialize on mouse:up
//
// /*
//  Stores annotation [primary key] to [annotation json] mappings for all annotations currently drawn on the canvas {pk: annotation json}
//  Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
//  */
// var annotationsDict = {};
//
// /*
//  Stores a dictionary of pre-set (string)color -> (string)hex pairs.
//  Loaded through ajax on document.onReady()
//  */
// var colorsDictionary = {};
//
//
// /* the mouse can be in 3 modes:
//  1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
//  2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
//  3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw onclicK)
//  getters and setters are below
//  */
// var mouseMode = "OSD";
//
// /*
//  Annotation type we draw on canvas on click (arrow on default), changed by #annotationType
//  */
// var annotationType = "arrow";
//
// /*
//  Default annotation color to draw annotations in
//  */
// var currentAnnotationColor = "white";
//
// $(document).ready(function () {
//     //color picker
//     var spectrumOptions = {
//         showPaletteOnly: true,
//         showPalette: true,
//         palette: getPaletteColors(),
//         color: colorsDictionary[Object.keys(colorsDictionary)[0]].hex //set default color as the "first" key in colorsDictionary
//     };
//     $("#colorPicker").spectrum(spectrumOptions);
// });
//
// /****************************************************************************************************************
//
//  A N N O T A T I O N S (Initializers and Updaters)
//
//  *****************************************************************************************************************/
// //annotations
// //Euclidean distance between (x1,y1) and (x2,y2)
// function distanceFormula(x1, y1, x2, y2) {
//     var xDist = Math.pow((x1 - x2), 2);
//     var yDist = Math.pow((y1 - y2), 2);
//     return Math.sqrt(xDist + yDist);
// }
//
// function initializeEllipse(x, y) {
//     ellipse = new fabric.Ellipse({
//         left: x,
//         top: y,
//         radius: 1,
//         strokeWidth: 25,
//         stroke: currentAnnotationColor,
//         fill: '',
//         selectable: true,
//         originX: 'center',
//         originY: 'center',
//         scaleX: 1,
//         scaleY: 1,
//         type: 'ellipse'
//     });
//     currentAnnotationType = ellipse
//     overlay.fabricCanvas().add(ellipse);
// }
//
// function updateEllipse(x, y) {
//     var distance = distanceFormula(x, y, origX, origY);
//     ellipse.set({rx: Math.abs(origX - x), ry: Math.abs(origY - y)});
//     currentAnnotationType = ellipse
// }
//
//
// function initializeRectangle(x, y) {
//     rectangle = new fabric.Rect({
//         left: x,
//         top: y,
//         fill: '',
//         strokeWidth: 25,
//         stroke: currentAnnotationColor,
//         width: 1,
//         height: 1,
//         scaleX: 1,
//         scaleY: 1,
//         type: 'rect'
//     });
//     currentAnnotationType = rectangle;
//     overlay.fabricCanvas().add(rectangle);
// }
//
// function updateRectangleWidth(x, y) {
//     var width = Math.abs(x - origX);
//     var height = Math.abs(y - origY);
//     rectangle.set({width: width, height: height});
//     currentAnnotationType = rectangle;
// }
//
// function initializeTextboxPreview(x, y) {
//     textboxPreview = new fabric.Rect({
//         left: x,
//         top: y,
//         fill: "",
//         strokeWidth: 25,
//         stroke: currentAnnotationColor,
//         width: 1,
//         height: 1,
//         type: 'textboxPreview'
//     });
//
//     currentAnnotationType = textboxPreview;
//     overlay.fabricCanvas().add(textboxPreview);
// }
//
// function updateTextboxPreview(x, y) {
//     var width = Math.abs(x - origX);
//     var height = Math.abs(y - origY);
//     textboxPreview.set({width: width, height: height});
//     currentAnnotationType = textboxPreview
// }
//
//
// /*
//  Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
//  computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
//  really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
//  */
//
// function drawArrow(x, y) {
//     var headlen = 100;  // arrow head size
//     arrow = new fabric.Polyline(calculateArrowPoints(origX, origY, x, y, headlen), {
//         fill: currentAnnotationColor,
//         stroke: 'black',
//         opacity: 1,
//         strokeWidth: 2,
//         originX: 'left',
//         originY: 'top',
//         scaleX: 1,
//         scaleY: 1,
//         selectable: true,
//         type: 'arrow'
//     });
//     currentAnnotationType = arrow;
//     overlay.fabricCanvas().add(arrow);
// }
//
// function updateArrow(x, y) {
//     var headlen = 100; //arrow head size
//     overlay.fabricCanvas().remove(arrow)
//     var angle = Math.atan2(y - origY, x - origX);
//
//     // bring the line end back some to account for arrow head.
//     x = x - (headlen) * Math.cos(angle);
//     y = y - (headlen) * Math.sin(angle);
//
//     // calculate the points.
//     var pointsArray = calculateArrowPoints(x, y, headlen);
//     arrow = new fabric.Polyline(pointsArray, {
//         fill: currentAnnotationColor,
//         stroke: 'black',
//         opacity: 1,
//         strokeWidth: 2,
//         originX: 'left',
//         originY: 'top',
//         selectable: true,
//         type: 'arrow'
//     });
//     currentAnnotationType = arrow;
//     overlay.fabricCanvas().add(arrow);
//     overlay.fabricCanvas().renderAll();
// }
//
// function calculateArrowPoints(x, y, headlen) {
//     var angle = Math.atan2(y - origY, x - origX);
//     var headlen = 100;  // arrow head size
//     // bring the line end back some to account for arrow head.
//     x = x - (headlen) * Math.cos(angle);
//     y = y - (headlen) * Math.sin(angle);
//
//     var points = [
//         {
//             x: origX,  // start point
//             y: origY
//         }, {
//             x: origX - (headlen / 4) * Math.cos(angle - Math.PI / 2),
//             y: origY - (headlen / 4) * Math.sin(angle - Math.PI / 2)
//         }, {
//             x: x - (headlen / 4) * Math.cos(angle - Math.PI / 2),
//             y: y - (headlen / 4) * Math.sin(angle - Math.PI / 2)
//         }, {
//             x: x - (headlen) * Math.cos(angle - Math.PI / 2),
//             y: y - (headlen) * Math.sin(angle - Math.PI / 2)
//         }, {
//             x: x + (headlen) * Math.cos(angle),  // tip
//             y: y + (headlen) * Math.sin(angle)
//         }, {
//             x: x - (headlen) * Math.cos(angle + Math.PI / 2),
//             y: y - (headlen) * Math.sin(angle + Math.PI / 2)
//         }, {
//             x: x - (headlen / 4) * Math.cos(angle + Math.PI / 2),
//             y: y - (headlen / 4) * Math.sin(angle + Math.PI / 2)
//         }, {
//             x: origX - (headlen / 4) * Math.cos(angle + Math.PI / 2),
//             y: origY - (headlen / 4) * Math.sin(angle + Math.PI / 2)
//         }, {
//             x: origX,
//             y: origY
//         }
//     ];
//     return points;
// }
//
// /****************************************************************************************************************
//
//  E V E N T  L I S T E N E R S
//
//  *****************************************************************************************************************/
// //event listeners
// //fabricJS mouse-down event listener
// overlay.fabricCanvas().observe('mouse:down', function (o) {
//     // console.log("EVENT TRIGERRED: fabricjs-mouse:down");
//     console.log("mouse mode is " + getMouseMode());
//     if (getMouseMode() == "addAnnotation") {
//         isDown = true;
//         var pointer = overlay.fabricCanvas().getPointer(o.e);
//         origX = pointer.x;
//         origY = pointer.y;
//         switch (annotationType) {
//             case "arrow":
//                 drawArrow(pointer.x, pointer.y);
//                 break;
//             case "rectangle":
//                 initializeRectangle(pointer.x, pointer.y);
//                 break;
//             case "ellipse":
//                 initializeEllipse(pointer.x, pointer.y);
//                 break;
//             case "text":
//                 // initializeText(pointer.x, pointer.y);
//                 initializeTextboxPreview(pointer.x, pointer.y);
//                 break;
//             default:
//                 console.log("welp, that shouldn't have happened. Undefined annotationType");
//                 throw new Error("Tried to switch to an undefined annotationType");
//         }
//     }
// });
//
// //fabricJS mouse-move event listener
// overlay.fabricCanvas().observe('mouse:move', function (o) {
//     if (!isDown) return;
//     var pointer = overlay.fabricCanvas().getPointer(o.e);
//
//     switch (annotationType) {
//         case "arrow":
//             updateArrow(pointer.x, pointer.y);
//             break;
//         case "rectangle":
//             updateRectangleWidth(pointer.x, pointer.y);
//             break;
//         case "ellipse":
//             updateEllipse(pointer.x, pointer.y);
//             break;
//         case "text":
//             updateTextboxPreview(pointer.x, pointer.y);
//             break;
//         default:
//             console.log("welp, that shouldn't have happened. Undefined annotationType");
//             throw new Error("Tried to switch to an undefined annotationType");
//     }
//     overlay.fabricCanvas().renderAll();
// });
//
// /* event listener that handles resizing the textbox based on amount of text */
// overlay.fabricCanvas().on('text:changed', function (opt) {
//     var t1 = opt.target;
//     if (t1.width > t1.fixedWidth) {
//         t1.fontSize *= t1.fixedWidth / (t1.width + 1);
//         t1.width = t1.fixedWidth;
//     }
// });
//
// //fabricJS mouse-up event listener
// overlay.fabricCanvas().on('mouse:up', function (o) {
//     // console.log("EVENT TRIGERRED: fabricj-mouse:up");
//     if (getMouseMode() == "addAnnotation") {
//         var pointerOnMouseUp = overlay.fabricCanvas().getPointer(event.e);
//
//         // save annotation to database
//         createNewSerialization(currentAnnotationType, pointerOnMouseUp.x, pointerOnMouseUp.y);
//
//         // If we just added a textbox, stay in edit mode so the user can edit. Otherwise, return to OSD navigation mode.
//         if(currentAnnotationType.type == "text") {
//             setMouseMode("editAnnotation");
//             $("#editAnnotation").click(); //set nav bar to editAnnotation
//         }else{
//             setMouseMode("OSD");
//             $("#navigateImage").click(); // change nav bar back to OSD (navigateImage)
//         }
//     }
//     isDown = false;
// });
//
// $("input[name='cursorMode']").change(function () {
//     // console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
//     var mode = $("input[name='cursorMode']:checked").val();
//     setMouseMode(mode);
// });
//
// $("input[name='annotationsOnOrOff']").change(function () {
//     var onOff = $("input[name='annotationsOnOrOff']:checked").val();
//     var objects = overlay.fabricCanvas().getObjects();
//     if (onOff == "off") {
//         for (var i = 0; i < objects.length; i++) {
//             //set all objects as invisible and lock in position
//             objects[i].visible = false;
//             objects[i].lockMovementX = true;
//             objects[i].lockMovementY = true;
//             objects[i].lockRotation = true;
//             objects[i].lockScalingFlip = true;
//             objects[i].lockScalingX = true;
//             objects[i].lockScalingY = true;
//             objects[i].lockSkewingX = true;
//             objects[i].lockSkewingY = true;
//             objects[i].lockUniScaling = true;
//         }
//     } else {
//         //set all objects as visible and unlock
//         for (var i = 0; i < objects.length; i++) {
//             objects[i].visible = true;
//             objects[i].lockMovementX = false;
//             objects[i].lockMovementY = false;
//             objects[i].lockRotation = false;
//             objects[i].lockScalingFlip = false;
//             objects[i].lockScalingX = false;
//             objects[i].lockScalingY = false;
//             objects[i].lockSkewingX = false;
//             objects[i].lockSkewingY = false;
//             objects[i].lockUniScaling = false;
//         }
//     }
//     overlay.fabricCanvas().renderAll();
// });
//
// $("input[name='annotationType']").change(function () {
//     // console.log("annotationType change detected: " + $("input[name='annotationShape']:checked").val());
//     annotationType = $("input[name='annotationType']:checked").val();
//     console.log("annotation shape changed to: " + annotationType);
// });
//
// overlay.fabricCanvas().on('object:modified', function () {
//     updateSerialization(overlay.fabricCanvas().getActiveObject());
// });
//
// $("#addAnnotation").click(function () {
//     setMouseMode("addAnnotation");
// });
//
// $('#loadAnnotation').click(function () {
//     getAnnotations();
// });
//
// $('#downloadScreenshot').click(function () {
//     var OSD_layer = viewer.drawer.canvas.toDataURL("image/png");
//     var annotations = overlay.fabricCanvas().toDataURL({format: 'image/png'});
//
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/mergeImages/',
//         datatype: 'json',
//         data: {
//             image1: OSD_layer,
//             image2: annotations
//         },
//         success: function (base64string) {  //do we have to index data?
//             console.log("IMAGE MERGE SUCCESS");
//             window.open("data:image/png;base64," + base64string);
//             // put in image tag and see if black bars/transparency still there
//             var img = new Image();
//             img.src = "data:image/png;base64," + base64string;
//
//             // $('#downloadImagePreview').prepend('<img id="imgPreview" src=img />')
//             document.getElementById('downloadImagePreview').src="data:image/png;base64," + base64string;
//             $('#my_image').attr('src', "data:image/png;base64," + base64string);
//             $('#my_image').width(800);
//         },
//         error: function (e) {
//             console.log("Ajax error");
//             console.log(e);
//         }
//     });
// });
//
// $('#deleteAnnotation').click(function () {
//     deleteActiveAnnotation();
// });
//
// $("#colorPicker").on('change.spectrum', function (e, color) {
//     currentAnnotationColor = color.toHexString(); //convert to hex
//     console.log("currentAnnotationColor is: " + currentAnnotationColor);
// });
//
// //sets if you can interact with objects on the fabricjs canvas
// function setFabricCanvasInteractivity(boolean) {
//     overlay.fabricCanvas().forEachObject(function (object) {
//         object.selectable = boolean;
//     });
// }
//
// function deselectFabricObjects() {
//     overlay.fabricCanvas().deactivateAll().renderAll();
// }
//
// function setMouseMode(mode) {
//     switch (mode) {
//         case "OSD":
//             console.log("mousemode: OSD");
//             mouseMode = "OSD";
//             setFabricCanvasInteractivity(false);
//             deselectFabricObjects();
//             viewer.setMouseNavEnabled(true);
//             // $('#viewerWrapper').css('cursor', 'crosshair');
//             document.getElementById("viewerWrapper").style.cursor = "crosshair";
//             break;
//         case "addAnnotation":
//             console.log("mousemode: addAnnotation");
//             mouseMode = "addAnnotation";
//             setFabricCanvasInteractivity(false);
//             deselectFabricObjects();
//             viewer.setMouseNavEnabled(false);
//             break;
//         case "editAnnotation":
//             console.log("mousemode: editAnnotation");
//             mouseMode = "editAnnotation";
//             setFabricCanvasInteractivity(true);
//             // $('#viewerWrapper').css('cursor', 'wait');
//             document.getElementById("viewerWrapper").style.cursor = "pointer";
//             viewer.setMouseNavEnabled(false);
//             break;
//         default:
//             console.log(mode);
//             throw "Tried to set invalid mouse mode";
//     }
// }
//
// function getMouseMode() {
//     return mouseMode;
// }
//
// function duplicateObject(object) {
//     var objectCopy = {
//         left: object["left"],
//         top: object["top"],
//         stroke: object["stroke"],
//         strokeWidth: object["strokeWidth"],
//         originX: object["originX"],
//         originY: object["originY"],
//         fill: object["fill"],
//         angle: object["angle"],
//         type: object["type"],
//         scaleX: object["scaleX"],
//         scaleY: object["scaleY"],
//         points: object["points"],
//         text: object["text"],
//         rx: object["rx"],
//         ry: object["ry"],
//         height: object["height"],
//         width: object["width"],
//         pk: object["pk"],
//         image: object["image"]
//     };
//     return objectCopy;
// }
//
// function objectListToJsonList(list) {
//     var retval = [];
//     list.foreach(function (object) {
//         retval.push(duplicateObject(object));
//     });
//     return JSON.stringify(retval);
// }
//
// function getAnnotations() {
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/getAnnotations/1',
//         datatype: 'json',
//         success: function (data) {
//             console.log(data);
//             data.forEach(function (annotation) {
//                 //convert django pk/id to hex color
//                 console.log(annotation);
//                 // annotation["stroke"] = colorsDictionary[annotation["strokeColor"]].hex;
//                 addAnnotationToCanvas(annotation);
//             });
//         },
//         error: function (a) {
//             console.log(a);
//         }
//     });
// }
//
// function createNewSerialization(fabricObject, x, y) {
//     if (fabricObject.type == "textboxPreview") {
//         text = new fabric.Textbox('MyText', {
//             width: x - origX,
//             top: origY,
//             left: origX,
//             fontSize: 100,
//             stroke: currentAnnotationColor,
//             fill: currentAnnotationColor,
//             borderColor: currentAnnotationColor,
//             textAlign: 'center',
//             scaleX: 1,
//             scaleY: 1,
//             type: 'text'
//         });
//         currentAnnotationType = text;
//         overlay.fabricCanvas().add(text);
//         textboxPreview.remove();
//         fabricObject = text;
//     }
//     console.log(fabricObject);
//
//     var temp = duplicateObject(fabricObject);
//     if(fabricObject.type == "arrow") { //arrow only needs fill
//         temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
//         temp["stroke"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load
//
//     }else if (fabricObject.type == "text") { //text needs both stroke and fill
//          temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
//          temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
//     } else { //everything else only needs stroke
//         temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
//         temp["fill"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
//     }
//
//     console.log("add annotation dump");
//     console.log(temp);
//
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/addAnnotation/',
//         datatype: 'json',
//         data: {
//             annotation: JSON.stringify(temp),
//             image_pk: 1
//         },
//         success: function (data) {
//             fabricObject.set({pk: data["pk"], image: data["image_pk"]});
//         },
//         error: function (e) {
//             console.log("Ajax error");
//             console.log(e);
//         }
//     });
// }
//
// function updateSerialization(fabricObject) {
//     var temp = duplicateObject(fabricObject);
//
//     if(fabricObject.type == "arrow") { //arrow only needs fill
//         temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
//         temp["stroke"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load
//
//     }else if (fabricObject.type == "text") { //text needs both stroke and fill
//         temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
//         temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
//     } else { //everything else only needs stroke
//         temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
//         temp["fill"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
//     }
//
//     console.log("alter annotation dump");
//     console.log(temp);
//     console.log(JSON.stringify(temp));
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/alterAnnotation/',
//         datatype: 'json',
//         data: {
//             //annotation: Json.stringify(fabricObject),
//             annotation: JSON.stringify(temp),
//             image_pk: 1
//         },
//         success: function (data) {
//
//         },
//         error: function (a) {
//             console.log("Ajax error");
//             console.log(a)
//         }
//     });
// }
//
// function getAnnotationColors() {
//     console.log("JSON response w/ color dictionary incoming");
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/getAnnotationColors/',
//         datatype: 'json',
//         async: false,
//         success: function (colorsJson) {
//             console.log("raw annotations json dump " + colorsJson);
//             console.log(colorsJson);
//             colorsJson.forEach(function (color) {
//                 colorsDictionary[color["id"]] = {name: color["name"], hex: color["hex"], id: color["id"]};
//             });
//             currentAnnotationColor = colorsDictionary[Object.keys(colorsDictionary)[0]].hex;
//         },
//         error: function (a) {
//             console.log("Ajax error");
//             console.log(a)
//         }
//     });
// }
//
// /*
//  Given a hex, returns the django id/pk
//  MUST USE # IN FRONT
//  */
// function getColorIdFromHex(hexColor) {
//     for (var key in colorsDictionary) {
//         console.log("searching...");
//         if (colorsDictionary[key].hex.toString().toLowerCase() == hexColor.toString().toLowerCase()) {
//             console.log(hexColor.toString().toLowerCase() + " matches this key");
//             console.log(colorsDictionary[key]);
//             return colorsDictionary[key].id;
//         }
//     }
//     throw new Error("getColorIdFromHex couldn't find a match for " + hexColor);
//     return null;
// }
//
// /*
//  Populate colorsDictionary through getAnnotationColors()
//  Return array for spectrum color picker palette
//  */
// function getPaletteColors() {
//     getAnnotationColors(); //now the dictionary should be full
//
//     var retval = [];
//
//     var row1 = [];
//     var row2 = [];
//
//     var theKeys = Object.keys(colorsDictionary);
//
//     for (var i = 0; i < theKeys.length; i = i + 2) {
//         // console.log("row : " + i + ': ' +  colorsDictionary[theKeys[i]].hex);
//         row1.push(colorsDictionary[theKeys[i]].hex);
//         if (i + 1 < theKeys.length) {
//             row2.push(colorsDictionary[theKeys[i + 1]].hex);
//         }
//     }
//     retval.push(row1);
//     retval.push(row2);
//
//     return retval;
// }
//
// function deleteActiveAnnotation() {
//     var annotation = overlay.fabricCanvas().getActiveObject();
//     if (annotation["pk"] in annotationsDict) {
//         //TODO: remove from database
//         $.ajax({
//             type: "POST",
//             url: '/xgds_image/deleteAnnotation/',
//             datatype: "json",
//             data: {
//                 pk: annotation["pk"]
//             },
//             success: function (data) {
//                 console.log(data);
//             },
//             error: function (a) {
//                 console.log("Ajax error");
//                 console.log(a)
//                 throw new Error("Unable to delete the annotation's entry from the database");
//             }
//         });
//
//         //delete from dict and database
//         delete annotationsDict[annotation["pk"]];
//         overlay.fabricCanvas().getActiveObject().remove();
//     } else {
//         //annotation not saved in database anyways, just remove from canvas
//         overlay.fabricCanvas().getActiveObject().remove();
//     }
// }
//
// /*
//  Given an annotation model, add it to the canvas
//  */
// function addAnnotationToCanvas(annotationJson) {
//     if (annotationJson["pk"] in annotationsDict) {
//         console.log("Annotation is already drawn on canvas, aborting load for this annotation");
//         return;
//     } else { //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
//         annotationsDict[annotationJson["pk"]] = annotationJson;
//     }
//     if (annotationJson["annotationType"] == "Rectangle") {
//         addRectToCanvas(annotationJson);
//     } else if (annotationJson["annotationType"] == "Ellipse") {
//         addEllipseToCanvas(annotationJson);
//     } else if (annotationJson["annotationType"] == "Arrow") {
//         addArrowToCanvas(annotationJson);
//     } else if (annotationJson["annotationType"] == "Text") {
//         addTextToCanvas(annotationJson);
//     } else {
//         throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
//     }
// }
//
// function addRectToCanvas(annotationJson) {
//     var rect = new fabric.Rect({
//         left: annotationJson["left"],
//         top: annotationJson["top"],
//         stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
//         strokeWidth: annotationJson["strokeWidth"],
//         originX: annotationJson["originX"],
//         originY: annotationJson["originY"],
//         fill: "",  //don't support fill
//         angle: annotationJson["angle"],
//         width: annotationJson["width"],
//         height: annotationJson["height"],
//         type: 'rect',
//         scaleX: annotationJson["scaleX"],
//         scaleY: annotationJson["scaleY"],
//         pk: annotationJson["pk"],
//         image: annotationJson["image"]
//     });
//     overlay.fabricCanvas().add(rect);
//     overlay.fabricCanvas().renderAll();
// }
//
// function addEllipseToCanvas(annotationJson) {
//     ellipse = new fabric.Ellipse({
//         left: annotationJson["left"],
//         top: annotationJson["top"],
//         stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
//         strokeWidth: annotationJson["strokeWidth"],
//         originX: annotationJson["originX"],
//         originY: annotationJson["originY"],
//         fill: "",  //don't support fill
//         angle: annotationJson["angle"],
//         rx: annotationJson["radiusX"],
//         ry: annotationJson["radiusY"],
//         type: 'ellipse',
//         scaleX: annotationJson["scaleX"],
//         scaleY: annotationJson["scaleY"],
//         pk: annotationJson["pk"],
//         image: annotationJson["image"]
//     });
//     overlay.fabricCanvas().add(ellipse);
//     overlay.fabricCanvas().renderAll();
// }
//
// function addArrowToCanvas(annotationJson) {
//     /* Arrows "stroke" is actually their fill. Their stroke/border is always black */
//     arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
//         left: annotationJson["left"],
//         top: annotationJson["top"],
//         stroke: 'black',
//         // stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
//         strokeWidth: annotationJson["strokeWidth"],
//         originX: annotationJson["originX"],
//         originY: annotationJson["originY"],
//         fill: colorsDictionary[annotationJson["fill"]].hex,
//         angle: annotationJson["angle"],
//         type: 'arrow',
//         scaleX: annotationJson["scaleX"],
//         scaleY: annotationJson["scaleY"],
//         pk: annotationJson["pk"],
//         image: annotationJson["image"]
//     });
//     console.log("image and pk pls");
//     overlay.fabricCanvas().add(arrow);
//     overlay.fabricCanvas().renderAll();
// }
//
// function addTextToCanvas(annotationJson) {
//     console.log("text annotation object");
//     console.log(annotationJson);
//     text = new fabric.Textbox("hello world", {
//         left: annotationJson["left"],
//         top: annotationJson["top"],
//         stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
//         strokeWidth: annotationJson["strokeWidth"],
//         originX: annotationJson["originX"],
//         originY: annotationJson["originY"],
//         fill: colorsDictionary[annotationJson["fill"]].hex,
//         borderColor: colorsDictionary[annotationJson["fill"]].hex,
//         angle: annotationJson["angle"],
//         width: annotationJson["width"],
//         height: annotationJson["height"],
//         text: annotationJson["content"], //text should be the right field here //todonow: this may be the wrong thing to call it.
//         type: 'text',
//         scaleX: annotationJson["scaleX"],
//         scaleY: annotationJson["scaleY"],
//         pk: annotationJson["pk"],
//         image: annotationJson["image"],
//         textAlign: 'center',
//         fontSize: 100 //Font size is static for now
//     });
//     console.log("textbox width (this is causing the error: " + annotationJson["width"]);
//
//
//     overlay.fabricCanvas().add(text);
//     overlay.fabricCanvas().renderAll();
// }
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
