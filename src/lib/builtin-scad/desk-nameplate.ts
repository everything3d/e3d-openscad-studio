export const DESK_NAMEPLATE_SCAD = String.raw`
// Desk nameplate.
// A flat plate with a raised name, an optional title line and a raised rim,
// plus a separate stand that holds the plate leaning back at a reading angle.
// The plate prints face up, so the lettering comes out crisp in a second
// colour; it then slides into the slot in the stand.
//
// showAssembled = false lays both parts out flat, ready to slice.
// showAssembled = true shows the plate standing in its stand.

/* [Text] */
name = "Riya Sharma";
// Second line under the name; leave empty for a name-only plate
title = "Product Designer";
nameFont = "Archivo Black"; // font
titleFont = "Montserrat"; // font
nameSize = 13;
titleSize = 6;
// Vertical space between the name and the title
lineGap = 5;
// Thickens thin strokes so small text prints cleanly
titleBoldening = 0.15;

/* [Plate] */
plateHeight = 50;
// The plate widens to fit the text, within these limits
minPlateWidth = 150;
maxPlateWidth = 220;
// Clear space between the text and the rim on each side
sidePadding = 12;
plateThickness = 3;
cornerRadius = 4;
// Raised rim around the plate edge; set rimWidth = 0 for none
rimWidth = 1.6;
rimHeight = 1.0;
textHeight = 1.2;

/* [Stand] */
// How far the plate leans back from vertical, in degrees
leanAngle = 15;
standDepth = 30;
standHeight = 14;
// The stand runs this fraction of the plate width
standLengthFraction = 0.7;
slotDepth = 9;
// Extra slot width so the plate slides in; raise it if the fit is too tight
slotClearance = 0.35;

/* [Colors] */
plateColor = "#22252B"; // color
textColor = "#E9C46A"; // color
standColor = "#22252B"; // color

/* [Preview] */
showAssembled = false;

/* [Hidden] */
$fn = 64;
hasTitle = title != "";
nameMetrics = textmetrics(name, size = nameSize, font = nameFont, halign = "center", valign = "center");
titleMetrics = hasTitle
    ? textmetrics(title, size = titleSize, font = titleFont, halign = "center", valign = "center")
    : undef;

maxTextWidth = maxPlateWidth - 2 * (sidePadding + rimWidth);
nameScale = min(1, maxTextWidth / nameMetrics.size.x);
titleScale = hasTitle ? min(1, maxTextWidth / (titleMetrics.size.x + 2 * titleBoldening)) : 1;
nameWidth = nameMetrics.size.x * nameScale;
titleWidth = hasTitle ? (titleMetrics.size.x + 2 * titleBoldening) * titleScale : 0;
plateWidth = max(minPlateWidth, max(nameWidth, titleWidth) + 2 * (sidePadding + rimWidth));

nameInk = nameMetrics.size.y * nameScale;
titleInk = hasTitle ? titleMetrics.size.y * titleScale : 0;
blockHeight = nameInk + (hasTitle ? lineGap + titleInk : 0);
nameY = blockHeight / 2 - nameInk / 2;
titleY = -blockHeight / 2 + titleInk / 2;

standLength = plateWidth * standLengthFraction;
slotWidth = plateThickness + slotClearance;
// Slightly forward of centre, so the lean puts the plate's weight over the stand
slotY = -standDepth * 0.12;

assert(blockHeight <= plateHeight - 2 * (rimWidth + 3),
       "Text is too tall for the plate. Reduce nameSize/titleSize/lineGap or increase plateHeight.");
assert(slotDepth <= standHeight - 3, "slotDepth must leave at least 3mm of stand under the slot.");

module rounded_rect(w, h, r) {
    offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}

// Text centred on its ink rather than the font's nominal box.
module centered_text(value, size, font, metrics, s) {
    scale([s, s])
        translate([-(metrics.position.x + metrics.size.x / 2), -(metrics.position.y + metrics.size.y / 2)])
            text(value, size = size, font = font, halign = "center", valign = "center");
}

module plate() {
    color(plateColor)
        linear_extrude(height = plateThickness)
            rounded_rect(plateWidth, plateHeight, cornerRadius);
    color(textColor)
        translate([0, 0, plateThickness]) {
            if (rimWidth > 0)
                linear_extrude(height = rimHeight)
                    difference() {
                        rounded_rect(plateWidth, plateHeight, cornerRadius);
                        rounded_rect(plateWidth - 2 * rimWidth, plateHeight - 2 * rimWidth,
                                     max(0.5, cornerRadius - rimWidth));
                    }
            linear_extrude(height = textHeight) {
                translate([0, nameY]) centered_text(name, nameSize, nameFont, nameMetrics, nameScale);
                if (hasTitle)
                    translate([0, titleY])
                        offset(delta = titleBoldening)
                            centered_text(title, titleSize, titleFont, titleMetrics, titleScale);
            }
        }
}

// A low bar with softened top edges and a slot leaning back by leanAngle.
module stand() {
    color(standColor)
        difference() {
            hull() {
                linear_extrude(height = 0.01)
                    rounded_rect(standLength, standDepth, 4);
                translate([0, 0, standHeight - 0.01])
                    linear_extrude(height = 0.01)
                        rounded_rect(standLength - 6, standDepth - 6, 2);
            }
            translate([0, slotY, standHeight])
                rotate([-leanAngle, 0, 0])
                    translate([-(standLength + 2) / 2, -slotWidth / 2, -slotDepth])
                        cube([standLength + 2, slotWidth, slotDepth + standHeight]);
        }
}

if (showAssembled) {
    stand();
    // Stand the plate up (text facing -Y), tilt it back, and seat its bottom
    // edge on the floor of the slot.
    translate([0, slotY, standHeight])
        rotate([-leanAngle, 0, 0])
            translate([0, plateThickness / 2, plateHeight / 2 - slotDepth])
                rotate([90, 0, 0])
                    plate();
} else {
    plate();
    translate([0, -(plateHeight / 2 + standDepth / 2 + 10), 0])
        stand();
}
`
