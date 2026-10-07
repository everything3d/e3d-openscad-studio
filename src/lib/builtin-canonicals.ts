export const SYSTEM_CANONICAL_OWNER_ID = 'system:e3d'

export interface BuiltInCanonical {
  id: string
  versionId: string
  versionNumber: number
  title: string
  description: string
  category: string
  code: string
  modificationGuide: string
  thumbnail: string
  /**
   * Earlier ids for this same design, retired by a rename. A database seeded
   * before the rename still holds those rows, so the seeder archives them
   * instead of leaving the starter library showing the design twice.
   */
  supersedes?: readonly string[]
}

const THREE_LAYER_PIGGY_BANK_SCAD = String.raw`
// Product source: everything3d/openscad/piggybankGenerator_veera_3layer.scad
// Synced from commit 7ae4d11 (Short-name letterSpacing + 3layer back-engraving).
// 3-LAYER name-sign piggy bank (white base + darker outline layer + lighter face layer).
// Variant of piggybankGenerator_veera.scad where the name is built from two stacked,
// offset text layers (see text_with_color() and the "Two-layer name options" block)
// giving the raised two-tone letter look. Exports 3 objects (base / outline / face)
// so each gets its own filament in the slicer.
//
// Use preview just for checking the font style, size... Change it to print before exporting the STL, so it is ready to print in place.
mode = "print";  // [preview, print]
name = "Veera";
font = "Spicy Sale"; // font
textSize = 40;
// Horizontal squish applied to the name only (1.0 = the font's natural width).
// Spicy Sale is a very wide/fat face, so a full-height name runs too long. This
// condenses the letters in X while keeping textSize (letter HEIGHT) intact, so
// the sign gets narrower without the letters getting shorter. Applied to the
// glyphs before the padding/rim offsets, so the border stays an even width.
nameXScale = 0.75;
// Letter spacing factor (1.0 = normal). Nudged up for very short names so the
// bank body isn't uncomfortably small, instead of padding the name with
// bracket characters.
letterSpacing = 1.0;

// The height of the box
extrudeHeight = 40;  // Adjusted for a hucha

// Diameter of the hole for adding the leds
coinLidHoleDiameter = 30;

// Width of the coin slot
coinSlotWidth = 5;
// Length of the coin slot
coinSlotLength = 35;

// If enabled, will fill the gaps in the text when a space is added
flatBase = false;

/* [Colors options] */
// Color for the box
boxColor = "#9DC7C8"; // color
// Color for the font (top/upper layer of the name)
fontColor = "#F7A6C4"; // color
// Color for the lower/outline layer of the name (2-layer look)
fontColor2 = "#8E2C7E"; // color

/* [Two-layer name options] */
// How far the darker lower layer spreads out past the letter face (mm)
nameLowerOffset = 2.5;
// Visible rise of the lighter upper letter face (mm)
nameUpperHeight = 2.0;
// Rise of the darker lower layer above the plate (mm).
// The base lip (nameLayerHeight = 1.2) buries ~1.2mm of this, so with 3.2 here
// the *visible* magenta wall (~2.0) matches the pink face above it.
nameLowerHeight = 3.2;

/* [Back engraving] */
// Small text engraved into the UNDERSIDE of the bank (e.g. "From X"). Empty
// string = no engraving. It is a plain recess, no second colour.
backText = "";
// A plain sans, not the display font used on the front — it stays legible much
// smaller. Bold on purpose: at 0.4mm deep a thin stroke cuts a groove too narrow
// for the nozzle to resolve, so the line comes out mushy.
backTextFont = "Helvetica:style=Bold"; // font
backTextSize = 5.5;
// Depth of the recess. Shallow on purpose — the base is only baseWidth thick.
backTextDepth = 0.4;
// Where the line sits on the underside. The usable band is narrow: the coin
// hole tops out at y=30 and the letters (so the scalloped outer edge) start
// closing in above y≈43, so 37 centres the line in the gap between them.
backTextY = 37;
backTextXOffset = 0;

/* [Expert options] */
baseWidth = 1.5;
offsetValue = textSize / 4; // Increase/decrease the space surrounding the text
coinHoleXOffset = 0;  // Offset for the coin hole in the X-axis
coinHoleYOffset = 0;  // Offset for the coin hole in the Y-axis
coinSlotYOffset = 0; // Y offset for the coin slot
lidStep = 5;
nameLayerHeight = 1.2;  // Height of the layer containing the text
lidSecureClipLength = 5; // Length of the clips that hold the coins lid
lidSecureClipWidth = 10;
coinLidBaseWidth = 0.5;
coinLidBaseExtraRadius = 5;
coinLidHeight = baseWidth - 1;
notchHeight = 4;
// Modify it for adjusting the tolerance between the box and the coin lid
coinLidTolerance = 0.15;
// If enabled, will fill the gaps in the text
fillGaps = true;
// How far up the cap height the gap-filling band reaches (0..1). The band bridges
// the gaps between letters so the box is one sealed piece; keep this well under 1
// so the rounded letter tops stay proud of it instead of being flattened into a
// straight edge. (Deriving this from the hyphen's ascent, as the original did,
// breaks on fonts like Spicy Sale whose hyphen sits high.)
gapsBandFraction = 0.5;
textTaper = 1.5; // Taper amount for support-free printing (creates ~45° angle)


/* [Hidden] */
$fn = 100;  // Increase the resolution of the circle
offsetDecrease = 2;  // Configuration for the new smaller offset
notchLength = (lidSecureClipLength - 1);
notchWidth = lidSecureClipWidth / (30/coinLidHoleDiameter);

metrics = textmetrics(name, size = textSize, font = font, spacing = letterSpacing);
// X-axis metrics are squished by nameXScale to match the scaled glyphs;
// Y-axis metrics (height/ascent/descent) are left at full size.
text_width = metrics.size.x * nameXScale;
text_height = metrics.size.y;
descent = -metrics.descent;
ascent = metrics.ascent;
position = [metrics.position.x * nameXScale, metrics.position.y];
half_text_width = text_width / 2;
x_translation = -half_text_width - position.x;
y_translation = -textSize * 2 - 5 + position.y;

lowMetrics = textmetrics("-", size = textSize, font = font);
lowAscent = lowMetrics.ascent;

// The name glyphs, condensed horizontally by nameXScale. Every place the name is
// drawn goes through here so the plate, the rim and the letter face all agree.
module name_text() {
    scale([nameXScale, 1]) {
        text(name, size = textSize, font = font, spacing = letterSpacing);
    }
}

module extruded_text(extrude_h, offset_v) {
    color(boxColor) {
        linear_extrude(extrude_h) {
            offset(offset_v) {
                fill(){
                    name_text();
                }
                if (flatBase == true) {
                    draw_base_rectangle();
                }
                if (fillGaps == true) {
                    draw_gaps_rectangle();
                }
            }
        }
    }
}

module text_with_color() {
    // Lower/darker layer: slightly larger footprint (offset), sits directly on the plate.
    color(fontColor2) {
        // Rise above the plate
        linear_extrude(nameLowerHeight) {
            offset(nameLowerOffset) {
                name_text();
            }
        }
        // Extrude downward to match the lip height (tenon into the plate)
        mirror([0, 0, 1]) {
            linear_extrude(lidStep) {
                offset(nameLowerOffset) {
                    name_text();
                }
            }
        }
    }
    // Upper/lighter layer: the actual letter face, sitting on top of the darker rim.
    color(fontColor) {
        translate([0, 0, nameLowerHeight]) {
            linear_extrude(nameUpperHeight) {
                name_text();
            }
        }
    }
}

module offset_text_piece() {
    difference() {
        extruded_text(nameLayerHeight, offsetValue);
        text_with_color();
    }
}

// Text recessed into the underside of the bank (z = 0 face).
// Mirrored in X so it reads correctly when the bank is flipped over and viewed
// from below — unmirrored it would come out backwards on the actual print.
module back_text_cut() {
    if (backText != "") {
        translate([half_text_width + position.x + backTextXOffset, backTextY, -0.01]) {
            linear_extrude(backTextDepth + 0.01) {
                mirror([1, 0, 0]) {
                    text(backText, size = backTextSize, font = backTextFont,
                         halign = "center", valign = "center");
                }
            }
        }
    }
}

module center_circle() {
    union() {
        cylinder(h = baseWidth * 4, d = coinLidHoleDiameter, center = false);
        translate([(-coinLidHoleDiameter - lidSecureClipLength) / 2, -coinLidHoleDiameter / 4, 0]) {
            cube([coinLidHoleDiameter + lidSecureClipLength, coinLidHoleDiameter / 2, baseWidth * 4]);
        }
    }
}

module draw_base_rectangle() {
    translate([position.x, position.y, 0]) {
        square([text_width, descent]);
    }
}

module draw_gaps_rectangle() {
    startFinishOffset = offsetValue;
    translate([position.x + startFinishOffset, position.y + descent, 0]) {
        square([text_width - startFinishOffset * 2, ascent * gapsBandFraction]);
    }
}

module coin_slot() {
    cube([coinSlotWidth, ascent, coinSlotLength]);
}

module notch(){
    translate([0, 0, coinLidBaseWidth + coinLidHeight]){
        rotate_extrude(angle= widthtoangle(notchWidth)){
            translate([coinLidHoleDiameter/2 - 1.5, 0, 0]){
                polygon([[0,0],[0,notchHeight],[notchLength,notchHeight]]);
            }
        }
    }
}
function widthtoangle(width) = width/(PI*coinLidHoleDiameter/2/180);

module coin_lid() {
    color(boxColor) {
        difference(){
            union(){
                cylinder(coinLidBaseWidth + coinLidHeight + notchHeight, d = coinLidHoleDiameter - coinLidTolerance);
                linear_extrude(height = coinLidBaseWidth){
                    circle(d = coinLidHoleDiameter + coinLidBaseExtraRadius * 2);
                }
                for(i = [0:2]){
                    rotate([0,0,i*(360/2)]){
                        notch();
                    }
                }
            };
            translate([0, 0, -1]){
                linear_extrude(height = 4){
                    difference(){
                        circle(d = coinLidHoleDiameter-5);
                        square([coinLidHoleDiameter-5, 5], true);
                    }
                }
            };
        }
    }
}
translate([x_translation, 0, 0]) {
    color(boxColor) {
        union() {
            difference(){
                union(){
                    difference() {
                        extruded_text(extrudeHeight - lidStep, offsetValue);
                        translate([0, 0, baseWidth]) {
                            extruded_text(extrudeHeight - baseWidth - nameLayerHeight, offsetValue - offsetDecrease);
                        }
                        translate([half_text_width + coinSlotYOffset, ascent / 2, (extrudeHeight - coinSlotLength) / 2]) {
                            coin_slot();
                        }
                    }
                    translate([half_text_width + position.x + coinHoleXOffset, coinLidHoleDiameter / 2 + coinHoleYOffset, baseWidth]) {
                        rotate([0,0,50]){
                            translate([(-coinLidHoleDiameter - lidSecureClipLength - 5) / 2, -coinLidHoleDiameter / 4, 0]) {
                                cube([coinLidHoleDiameter + lidSecureClipLength + 5, lidSecureClipWidth, baseWidth*2.5]);
                            }
                        }
                    }
                }
                translate([half_text_width + position.x + coinHoleXOffset, coinLidHoleDiameter / 2 + coinHoleYOffset, 0]) {
                    center_circle();
                }
                back_text_cut();
            }
            translate([0, 0, extrudeHeight - lidStep]) {
                difference() {
                    extruded_text(lidStep, offsetValue - offsetDecrease / 2);
                    extruded_text(lidStep, offsetValue - offsetDecrease);
                }
            }
        }
    }
}

translate([0, text_height + coinLidHoleDiameter + 10, 0]) {
    coin_lid();
}

if (mode != "preview") {
    translate([x_translation, y_translation/2, lidStep + nameLayerHeight]) {
        rotate([180, 0, 0]) {
            difference() {
                extruded_text(lidStep, offsetValue);
                translate([0, 0, 0]) {
                    extruded_text(lidStep, offsetValue - offsetDecrease / 2 + 0.05);
                }
            }
            translate([0.01 /2, 0, lidStep]) {
                offset_text_piece();
                translate([0, 0, 0.02]) {
                    text_with_color();
                }
            }
        }
    }
} else {
    translate([x_translation, y_translation, 0]) {
        difference() {
            extruded_text(lidStep, offsetValue);
            translate([0, 0, 0]) {
                extruded_text(lidStep, offsetValue - offsetDecrease / 2 + 0.05);
            }
        }
        translate([0, 0, lidStep]) {
            offset_text_piece();
            text_with_color();
        }
    }
}
`

const TWO_LAYER_PIGGY_BANK_SCAD = String.raw`
// Product source: everything3d/openscad/piggybankGenerator_veera.scad
// Synced from commit 7ae4d11 (Short-name letterSpacing + 3layer back-engraving).
// Use preview just for checking the font style, size... Change it to print before exporting the STL, so it is ready to print in place.
mode = "print";  // [preview, print]
name = "Veera";
font = "Baby Donuts"; // font
textSize = 40;
// Letter spacing factor (1.0 = normal). Increase to widen gaps between letters,
// e.g. to make a short name fill a usable bank width without padding brackets.
letterSpacing = 1.0;

// The height of the box
extrudeHeight = 40;  // Adjusted for a hucha

// Diameter of the hole for adding the leds
coinLidHoleDiameter = 30;

// Width of the coin slot
coinSlotWidth = 5;
// Length of the coin slot
coinSlotLength = 35;

// If enabled, will fill the gaps in the text when a space is added
flatBase = false;

/* [Colors options] */
// Color for the box
boxColor = "#9DC7C8"; // color
// Color for the font
fontColor = "#F39237"; // color

/* [Expert options] */
baseWidth = 1.5;
offsetValue = textSize / 4; // Increase/decrease the space surrounding the text
coinHoleXOffset = 0;  // Offset for the coin hole in the X-axis
coinHoleYOffset = 0;  // Offset for the coin hole in the Y-axis
coinSlotYOffset = 0; // Y offset for the coin slot
lidStep = 5;
nameLayerHeight = 1.2;  // Height of the layer containing the text
lidSecureClipLength = 5; // Length of the clips that hold the coins lid
lidSecureClipWidth = 10;
coinLidBaseWidth = 0.5;
coinLidBaseExtraRadius = 5;
coinLidHeight = baseWidth - 1;
notchHeight = 4;
// Modify it for adjusting the tolerance between the box and the coin lid
coinLidTolerance = 0.15;
// If enabled, will fill the gaps in the text
fillGaps = true;
textTaper = 1.5; // Taper amount for support-free printing (creates ~45° angle)


/* [Hidden] */
$fn = 100;  // Increase the resolution of the circle
offsetDecrease = 2;  // Configuration for the new smaller offset
notchLength = (lidSecureClipLength - 1);
notchWidth = lidSecureClipWidth / (30/coinLidHoleDiameter);

metrics = textmetrics(name, size = textSize, font = font, spacing = letterSpacing);
text_width = metrics.size.x;
text_height = metrics.size.y;
descent = -metrics.descent;
ascent = metrics.ascent;
position = metrics.position;
half_text_width = text_width / 2;
x_translation = -half_text_width - position.x;
y_translation = -textSize * 2 - 5 + position.y;

lowMetrics = textmetrics("-", size = textSize, font = font);
lowAscent = lowMetrics.ascent;

module extruded_text(extrude_h, offset_v) {
    color(boxColor) {
        linear_extrude(extrude_h) {
            offset(offset_v) {
                fill(){
                    text(name, size = textSize, font = font, spacing = letterSpacing);
                }
                if (flatBase == true) {
                    draw_base_rectangle();
                }
                if (fillGaps == true) {
                    draw_gaps_rectangle();
                }
            }
        }
    }
}

module text_with_color() {
    color(fontColor) {
        // Extrude upward (original)
        linear_extrude(nameLayerHeight + 3) {
            text(name, size = textSize, font = font, spacing = letterSpacing);
        }
        // Extrude downward to match the lip height
        mirror([0, 0, 1]) {
            linear_extrude(lidStep) {
                text(name, size = textSize, font = font, spacing = letterSpacing);
            }
        }
    }
}

module offset_text_piece() {
    difference() {
        extruded_text(nameLayerHeight, offsetValue);
        text_with_color();
    }
}

module center_circle() {
    union() {
        cylinder(h = baseWidth * 4, d = coinLidHoleDiameter, center = false);
        translate([(-coinLidHoleDiameter - lidSecureClipLength) / 2, -coinLidHoleDiameter / 4, 0]) {
            cube([coinLidHoleDiameter + lidSecureClipLength, coinLidHoleDiameter / 2, baseWidth * 4]);
        }
    }
}

module draw_base_rectangle() {
    translate([position.x, position.y, 0]) {
        square([text_width, descent]);
    }
}

module draw_gaps_rectangle() {
    startFinishOffset = offsetValue;
    translate([position.x + startFinishOffset, position.y + descent + lowAscent / 2, 0]) {
        square([text_width - startFinishOffset * 2, lowAscent]);
    }
}

module coin_slot() {
    cube([coinSlotWidth, ascent, coinSlotLength]);
}

module notch(){
    translate([0, 0, coinLidBaseWidth + coinLidHeight]){
        rotate_extrude(angle= widthtoangle(notchWidth)){
            translate([coinLidHoleDiameter/2 - 1.5, 0, 0]){
                polygon([[0,0],[0,notchHeight],[notchLength,notchHeight]]);
            }
        }
    }
}
function widthtoangle(width) = width/(PI*coinLidHoleDiameter/2/180);

module coin_lid() {
    color(boxColor) {
        difference(){
            union(){
                cylinder(coinLidBaseWidth + coinLidHeight + notchHeight, d = coinLidHoleDiameter - coinLidTolerance);
                linear_extrude(height = coinLidBaseWidth){
                    circle(d = coinLidHoleDiameter + coinLidBaseExtraRadius * 2);
                }
                for(i = [0:2]){
                    rotate([0,0,i*(360/2)]){
                        notch();
                    }
                }
            };
            translate([0, 0, -1]){
                linear_extrude(height = 4){
                    difference(){
                        circle(d = coinLidHoleDiameter-5);
                        square([coinLidHoleDiameter-5, 5], true);
                    }
                }
            };
        }
    }
}
translate([x_translation, 0, 0]) {
    color(boxColor) {
        union() {
            difference(){
                union(){
                    difference() {
                        extruded_text(extrudeHeight - lidStep, offsetValue);
                        translate([0, 0, baseWidth]) {
                            extruded_text(extrudeHeight - baseWidth - nameLayerHeight, offsetValue - offsetDecrease);
                        }
                        translate([half_text_width + coinSlotYOffset, ascent / 2, (extrudeHeight - coinSlotLength) / 2]) {
                            coin_slot();
                        }
                    }
                    translate([half_text_width + position.x + coinHoleXOffset, coinLidHoleDiameter / 2 + coinHoleYOffset, baseWidth]) {
                        rotate([0,0,50]){
                            translate([(-coinLidHoleDiameter - lidSecureClipLength - 5) / 2, -coinLidHoleDiameter / 4, 0]) {
                                cube([coinLidHoleDiameter + lidSecureClipLength + 5, lidSecureClipWidth, baseWidth*2.5]);
                            }
                        }
                    }
                }
                translate([half_text_width + position.x + coinHoleXOffset, coinLidHoleDiameter / 2 + coinHoleYOffset, 0]) {
                    center_circle();
                }
            }
            translate([0, 0, extrudeHeight - lidStep]) {
                difference() {
                    extruded_text(lidStep, offsetValue - offsetDecrease / 2);
                    extruded_text(lidStep, offsetValue - offsetDecrease);
                }
            }
        }
    }
}

translate([0, text_height + coinLidHoleDiameter + 10, 0]) {
    coin_lid();
}

if (mode != "preview") {
    translate([x_translation, y_translation/2, lidStep + nameLayerHeight]) {
        rotate([180, 0, 0]) {
            difference() {
                extruded_text(lidStep, offsetValue);
                translate([0, 0, 0]) {
                    extruded_text(lidStep, offsetValue - offsetDecrease / 2 + 0.05);
                }
            }
            translate([0.01 /2, 0, lidStep]) {
                offset_text_piece();
                translate([0, 0, 0.02]) {
                    text_with_color();
                }
            }
        }
    }
} else {
    translate([x_translation, y_translation, 0]) {
        difference() {
            extruded_text(lidStep, offsetValue);
            translate([0, 0, 0]) {
                extruded_text(lidStep, offsetValue - offsetDecrease / 2 + 0.05);
            }
        }
        translate([0, 0, lidStep]) {
            offset_text_piece();
            text_with_color();
        }
    }
}
`

const TWO_NAME_ILLUSION_SCAD = String.raw`
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

/**
 * Product-owned canonical designs installed automatically into the shared catalog.
 * IDs are deliberately stable so every deployment converges on the same rows.
 */
export const BUILT_IN_CANONICALS: readonly BuiltInCanonical[] = [
  {
    id: 'builtin-two-layer-name-piggy-bank',
    versionId: 'builtin-two-layer-name-piggy-bank-v1',
    versionNumber: 1,
    title: 'Two-layer name piggy bank',
    description:
      'A hollow bank cut to the shape of a name, with a coin slot and removable coin lid. Two printed layers — plate and raised name — so it prints on any two-color setup.',
    category: 'Personalized gifts',
    code: TWO_LAYER_PIGGY_BANK_SCAD,
    modificationGuide: `Keep the bank’s fitted parts and print orientation intact while customizing it.

Common changes:
- Change "name" first. For names of four characters or fewer, increase letterSpacing toward 1.2 so the bank remains a practical size.
- Change boxColor and fontColor for the two printable color regions.
- Use mode = "preview" for an upright visual review and mode = "print" for the printable name lid orientation.
- Adjust textSize for overall dimensions and coinLidTolerance only in small increments for the removable lid fit.

Gotchas:
- The design relies on textmetrics(); preserve its metric-derived positioning.
- Baby Donuts is bundled in the studio. If changing fonts, re-check the body width, gap-filling band, and unsupported letter islands.
- Keep the downward name tenon aligned with the matching plate recess.
- Preserve wall thickness around the hollow body, coin slot, and lid opening.`,
    thumbnail: '/canonicals/two-layer-name-piggy-bank.webp',
    supersedes: ['builtin-two-color-name-sign-piggy-bank'],
  },
  {
    id: 'builtin-three-layer-name-piggy-bank',
    versionId: 'builtin-three-layer-name-piggy-bank-v1',
    versionNumber: 1,
    title: 'Three-layer name piggy bank',
    description:
      'A hollow bank cut to the shape of a name, with a coin slot and removable coin lid. The name is built from three printed layers — plate, outline, and face — for a raised two-tone look.',
    category: 'Personalized gifts',
    code: THREE_LAYER_PIGGY_BANK_SCAD,
    modificationGuide: `Keep the bank’s fitted parts and print orientation intact while customizing it.

Common changes:
- Change \"name\" first. For names of four characters or fewer, increase letterSpacing toward 1.2 so the bank remains a practical size.
- Adjust nameXScale to fit long names without making the letters shorter. Keep it consistent everywhere by routing name geometry through name_text().
- Change boxColor, fontColor2, and fontColor for the three printable color regions.
- Use mode = \"preview\" for an upright visual review and mode = \"print\" for the printable name lid orientation.
- coinLidTolerance controls the removable lid fit; make small changes only.

Gotchas:
- The design relies on textmetrics(); preserve its metric-derived positioning.
- Keep the downward name tenon aligned with the matching plate recess.
- Preserve wall thickness around the hollow body, coin slot, and lid opening.
- Spicy Sale is bundled in the studio. If changing fonts, re-check width, gaps, and unsupported islands.`,
    thumbnail: '/canonicals/three-layer-name-piggy-bank.webp',
    supersedes: ['builtin-name-sign-piggy-bank'],
  },
  {
    id: 'builtin-two-name-illusion',
    versionId: 'builtin-two-name-illusion-v1',
    versionNumber: 1,
    title: 'Two-name illusion',
    description:
      'A perspective sculpture that reads one name from the front and another after a quarter turn, joined to a rounded display base.',
    category: 'Personalized gifts',
    code: TWO_NAME_ILLUSION_SCAD,
    modificationGuide: `This design works by intersecting two perpendicular extruded word silhouettes.

Common changes:
- Set frontName and sideName to the two names or short words.
- Prefer uppercase text and a bold font. Liberation Mono Bold is bundled and gives predictable strokes.
- Adjust letterSize and letterSpacing for the overall footprint. strokeBoost strengthens thin intersections.
- Change base padding, height, corner radius, or colors without altering the illusion geometry.

Gotchas:
- Always inspect both orthogonal views after changing words. Curved or thin glyph pairs can create fragile or disconnected islands.
- Very long names make the base large; reduce letterSize or spacing before compressing one axis.
- Lowercase i/j dots and delicate script fonts can float above the base. Prefer uppercase or add deliberate supports.
- Keep a small overlap between the sculpture and base so the exported mesh remains connected.`,
    thumbnail: '/canonicals/two-name-illusion.webp',
  },
] as const
