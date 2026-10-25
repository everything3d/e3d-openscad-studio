export const PODIUM_NAMEPLATE_SCAD = String.raw`
// Figurine podium with nameplate.
// A round, hollow podium with a seat on top for a figurine base and a curved
// pocket on the front. A thin nameplate with a raised name and up to two
// taglines prints flat, then bends into the pocket.
//
// The name shrinks only when it would overrun the plate. The taglines grow
// together to fill the plate width, up to tagMaxSize, so short and long
// taglines both look deliberate. The text block re-centres when a tagline
// is left empty.
//
// showAssembled = false lays the parts out to print: the plate flat and the
// podium upside down on its top face. showAssembled = true previews the
// plate wrapped into the pocket.

/* [Text] */
name = "Riya Sharma";
// Leave a tagline empty to drop it; the text re-centres
tagline1 = "Always on the go";
tagline2 = "";
nameFont = "Cutive"; // font
tagFont = "Akaya Kanadaka"; // font
// Largest name size; long names shrink to fit
nameSize = 10.5;
// Starting tagline size before growing to fill the plate width
tagSize = 4.5;
// Upper bound when a single short tagline grows
tagMaxSize = 8;
// Upper bound with two taglines, so the lines do not collide
tagMaxSizeTwoTags = 6;
// Clear space between the text and each end of the plate
sideMargin = 6;

/* [Plate] */
plateLength = 109;
plateWidth = 49;
plateThickness = 1;
cornerRadius = 5;
textHeight = 0.5;
// Thickens strokes so small text prints cleanly; 0.1–0.25 works well
boldAmount = 0.1;

/* [Layout] */
// Vertical positions of each line, measured from the plate centre
nameYTwoTags = 11;
nameYOneTag = 8.5;
tag1YTwoTags = -3;
tag1YOneTag = -9;
tag2Y = -12;

/* [Podium] */
podiumDiameter = 96;
podiumHeight = 64;
wallThickness = 8;
// Solid top above the hollow
topThickness = 9;
// Seat for the figurine's base; set figurineBaseDiameter = 0 for a flat top
figurineBaseDiameter = 50;
seatDepth = 4.5;
seatClearance = 0.5;
// 1 = front only, 2 = front and back
pocketCount = 1;
// Must hold the plate plus its raised text
pocketDepth = 2;
// Height of the pocket floor above the bottom of the podium
pocketBottom = 7;
// Extra pocket length and height around the plate
pocketClearanceLength = 1.5;
pocketClearanceHeight = 1;

/* [Colors] */
podiumColor = "#1F3A93"; // color
plateColor = "#F5F5F5"; // color
nameColor = "#111111"; // color
tagColor = "#1E90FF"; // color

/* [Preview] */
showAssembled = false;

/* [Hidden] */
$fn = 128;
maxTextWidth = plateLength - 2 * sideMargin;
R = podiumDiameter / 2;
pocketHeight = plateWidth + pocketClearanceHeight;
// The plate bends at the middle of its thickness, sitting on the pocket floor.
plateBendRadius = R - pocketDepth + plateThickness / 2;
pocketAngle = (plateLength + pocketClearanceLength) / plateBendRadius * 180 / PI;
seatDiameter = figurineBaseDiameter + seatClearance;

// Width text() occupies once the bold offset is applied.
function text_width(txt, size, font) =
    txt == "" ? 0 : textmetrics(txt, size = size, font = font).size.x + 2 * boldAmount;

nameFitSize = let(natural = text_width(name, nameSize, nameFont))
    natural > maxTextWidth ? nameSize * maxTextWidth / natural : nameSize;

tagCount = (tagline1 == "" ? 0 : 1) + (tagline2 == "" ? 0 : 1);

// Scale the taglines together so the wider one fills the plate, up to the cap.
tagFitSize = let(widest = max(text_width(tagline1, tagSize, tagFont), text_width(tagline2, tagSize, tagFont)))
    widest == 0 ? tagSize
    : min(tagCount == 2 ? tagMaxSizeTwoTags : tagMaxSize, tagSize * maxTextWidth / widest);

nameY = tagCount == 2 ? nameYTwoTags : (tagCount == 1 ? nameYOneTag : 0);
tag1Y = tagCount == 2 ? tag1YTwoTags : tag1YOneTag;

assert(cornerRadius * 2 < min(plateLength, plateWidth), "cornerRadius is too large for the plate.");
assert(pocketDepth >= plateThickness + textHeight,
       "pocketDepth must hold the plate and its raised text. Raise pocketDepth or thin the plate.");
assert(pocketDepth < wallThickness - 1.5, "pocketDepth leaves too little wall behind the pocket.");
assert(pocketAngle * pocketCount < 340, "The pockets overlap. Shorten the plate or use one pocket.");
assert(pocketBottom >= 2 && pocketBottom + pocketHeight <= podiumHeight - 2,
       "The pocket needs at least 2mm of podium above and below it. Adjust pocketBottom, narrow the plate or make the podium taller.");
assert(figurineBaseDiameter == 0 || seatDiameter < podiumDiameter - 2 * wallThickness,
       "The figurine seat is wider than the podium top allows.");

// ---------- Nameplate ----------

module plate_shape() {
    linear_extrude(height = plateThickness)
        offset(r = cornerRadius)
            offset(delta = -cornerRadius)
                square([plateLength, plateWidth], center = true);
}

// Grow the 2D outline with offset() before extruding, so strokes print bolder.
module bold_text(txt, size, font, y) {
    if (txt != "")
        translate([0, y, plateThickness])
            linear_extrude(height = textHeight)
                offset(r = boldAmount)
                    text(txt, size = size, font = font, halign = "center", valign = "center");
}

module name_text() {
    bold_text(name, nameFitSize, nameFont, nameY);
}

module tag_text() {
    // A single tagline sits in the tagline1 slot, whichever field holds it.
    bold_text(tagline1 == "" ? tagline2 : tagline1, tagFitSize, tagFont, tag1Y);
    if (tagCount == 2) bold_text(tagline2, tagFitSize, tagFont, tag2Y);
}

// The flat plate's three color regions, by index, so the wrap can bend each one.
module plate_part(part) {
    if (part == 0) plate_shape();
    else if (part == 1) name_text();
    else tag_text();
}

module flat_plate() {
    color(plateColor) plate_part(0);
    color(nameColor) plate_part(1);
    color(tagColor) plate_part(2);
}

// ---------- Podium ----------

module pocket() {
    translate([0, 0, pocketBottom])
        rotate([0, 0, -pocketAngle / 2])
            rotate_extrude(angle = pocketAngle, $fn = 256)
                translate([R - pocketDepth, 0])
                    square([pocketDepth + 1, pocketHeight]);
}

module podium() {
    color(podiumColor)
        difference() {
            cylinder(h = podiumHeight, r = R);
            // Hollow underneath, open at the bottom
            translate([0, 0, -1])
                cylinder(h = podiumHeight - topThickness + 1, r = R - wallThickness);
            if (figurineBaseDiameter > 0)
                translate([0, 0, podiumHeight - seatDepth])
                    cylinder(h = seatDepth + 1, d = seatDiameter);
            for (i = [0 : pocketCount - 1])
                rotate([0, 0, i * 360 / pocketCount]) pocket();
        }
}

// ---------- Assembled preview ----------

// Bend one color region of the flat plate around the podium in narrow strips.
// Flat x runs around the podium, flat y runs up it, flat z points outward.
module wrapped_part(part, stripWidth = 1.5) {
    floorRadius = R - pocketDepth;
    for (x = [-plateLength / 2 : stripWidth : plateLength / 2]) {
        a = x / plateBendRadius * 180 / PI;
        c = cos(a);
        s = sin(a);
        multmatrix([[-s, 0, c, c * floorRadius],
                    [ c, 0, s, s * floorRadius],
                    [ 0, 1, 0, pocketBottom + pocketHeight / 2],
                    [ 0, 0, 0, 1]])
            intersection() {
                translate([-x, 0, 0]) plate_part(part);
                translate([-stripWidth / 2 - 0.01, -plateWidth, -1])
                    cube([stripWidth + 0.02, 2 * plateWidth, plateThickness + textHeight + 2]);
            }
    }
}

if (showAssembled) {
    // The first pocket is on the +X side; turn it to face the viewer.
    rotate([0, 0, -90]) {
        podium();
        color(plateColor) wrapped_part(0);
        color(nameColor) wrapped_part(1);
        color(tagColor) wrapped_part(2);
    }
} else {
    flat_plate();
    // Upside down on its top face, so the hollow needs no support.
    translate([0, -(plateWidth / 2 + R + 10), podiumHeight])
        rotate([180, 0, 0]) podium();
}
`
