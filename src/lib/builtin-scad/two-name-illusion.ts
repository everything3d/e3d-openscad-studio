export const TWO_NAME_ILLUSION_SCAD = String.raw`
// E3D two-name perspective illusion.
// The solid is the intersection of two perpendicular extruded word silhouettes:
// one reads along the Y axis and the other along the X axis.
//
// Technique reference:
// https://rebecca.li/openscad-geb-inspired-block/
// This implementation is original and intentionally compact for AI customization.

/* [Names] */
frontName = "LOVE";
sideName = "HOME";

/* [Typography] */
// Bold monospaced faces produce the strongest, most printable illusion.
font = "Liberation Mono:style=Bold";
letterSize = 28;
letterSpacing = 0.92;
// Slightly expands each silhouette so narrow strokes survive the intersection.
strokeBoost = 0.35;

/* [Base] */
showBase = true;
baseHeight = 3;
basePadding = 4;
baseCornerRadius = 3;

/* [Colors] */
sculptureColor = "#F4C95D";
baseColor = "#26324A";

/* [Quality] */
$fn = 48;

/* [Hidden] */
overlap = 0.2;
frontMetrics = textmetrics(
    frontName,
    size = letterSize,
    font = font,
    spacing = letterSpacing,
    halign = "center",
    valign = "bottom"
);
sideMetrics = textmetrics(
    sideName,
    size = letterSize,
    font = font,
    spacing = letterSpacing,
    halign = "center",
    valign = "bottom"
);
frontWidth = frontMetrics.size.x + strokeBoost * 2;
sideWidth = sideMetrics.size.x + strokeBoost * 2;

module word_profile(value) {
    offset(delta = strokeBoost) {
        text(
            value,
            size = letterSize,
            font = font,
            spacing = letterSpacing,
            halign = "center",
            valign = "bottom"
        );
    }
}

// Reads when looking toward the Y axis.
module front_word_volume() {
    rotate([90, 0, 0]) {
        linear_extrude(height = sideWidth + basePadding * 2, center = true, convexity = 10) {
            word_profile(frontName);
        }
    }
}

// Reads when looking toward the X axis.
module side_word_volume() {
    rotate([90, 0, 90]) {
        linear_extrude(height = frontWidth + basePadding * 2, center = true, convexity = 10) {
            word_profile(sideName);
        }
    }
}

module rounded_base() {
    width = frontWidth + basePadding * 2;
    depth = sideWidth + basePadding * 2;
    radius = min(baseCornerRadius, min(width, depth) / 2);

    linear_extrude(height = baseHeight) {
        hull() {
            for (x = [-width / 2 + radius, width / 2 - radius])
                for (y = [-depth / 2 + radius, depth / 2 - radius])
                    translate([x, y]) circle(r = radius);
        }
    }
}

color(sculptureColor) {
    translate([0, 0, baseHeight - overlap]) {
        intersection() {
            front_word_volume();
            side_word_volume();
        }
    }
}

if (showBase) {
    color(baseColor) rounded_base();
}
`
