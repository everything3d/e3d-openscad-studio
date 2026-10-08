export const THREE_LAYER_NAME_PIGGY_BANK_SCAD = String.raw`
// Three-layer name piggy bank.
// A hollow coin bank cut to the outline of a name, with a coin slot in the
// back and a removable twist-lock coin lid underneath. The name lid on top is
// built from three printed colours: the plate, a darker outline layer, and a
// lighter letter face that sits on the outline for a raised two-tone look.
//
// Every part is laid out flat and face up, ready to slice.
name = "Aarav";
font = "Spicy Sale"; // font
textSize = 40;
// Horizontal squish applied to the name only (1.0 = the font's natural width).
// Spicy Sale is very wide, so a full-height name runs long. This condenses the
// letters in X while keeping textSize (letter HEIGHT) intact, so the bank gets
// narrower without the letters getting shorter. Applied to the glyphs before
// the padding/rim offsets, so the border stays an even width.
nameXScale = 0.75;
// Letter spacing factor (1.0 = normal). Raise it toward 1.2 for names of four
// letters or fewer so the bank body is not uncomfortably small.
letterSpacing = 1.0;

// Overall height of the bank
extrudeHeight = 40;

// Diameter of the coin lid opening in the base
coinLidHoleDiameter = 30;

// Width of the coin slot
coinSlotWidth = 5;
// Length of the coin slot
coinSlotLength = 35;

// If enabled, fills the gaps under the letters when the name contains a space
flatBase = false;

/* [Colors options] */
// Colour of the bank body and plate
boxColor = "#9DC7C8"; // color
// Colour of the letter face (top layer of the name)
fontColor = "#F7A6C4"; // color
// Colour of the outline layer under the letter face
fontColor2 = "#8E2C7E"; // color

/* [Two-layer name options] */
// How far the darker outline layer spreads out past the letter face (mm)
nameLowerOffset = 2.5;
// Visible rise of the lighter letter face (mm)
nameUpperHeight = 2.0;
// Rise of the darker outline layer above the plate (mm).
// The plate lip (nameLayerHeight = 1.2) buries ~1.2mm of this, so with 3.2 here
// the visible outline wall (~2.0) matches the face above it.
nameLowerHeight = 3.2;

/* [Back engraving] */
// Small text engraved into the UNDERSIDE of the bank (e.g. "Love, Mom").
// Empty string = no engraving. It is a plain recess, no second colour.
backText = "";
// A plain bold sans stays legible far smaller than the display font. Bold on
// purpose: at 0.4mm deep a thin stroke cuts a groove too narrow for the
// nozzle to resolve.
backTextFont = "Liberation Sans:style=Bold"; // font
backTextSize = 5.5;
// Depth of the recess. Shallow on purpose: the base is only baseWidth thick.
backTextDepth = 0.4;
// Where the line sits on the underside. The usable band is narrow: the coin
// hole tops out at y=30 and the scalloped outer edge closes in above y≈43, so
// 37 centres the line in the gap between them.
backTextY = 37;
backTextXOffset = 0;

/* [Expert options] */
baseWidth = 1.5;
offsetValue = textSize / 4; // Space around the letters that forms the body
coinHoleXOffset = 0;  // Offset for the coin hole in the X-axis
coinHoleYOffset = 0;  // Offset for the coin hole in the Y-axis
coinSlotYOffset = 0; // Y offset for the coin slot
lidStep = 5;
nameLayerHeight = 1.2;  // Height of the layer containing the text
lidSecureClipLength = 5; // Length of the clips that hold the coin lid
lidSecureClipWidth = 10;
coinLidBaseWidth = 0.5;
coinLidBaseExtraRadius = 5;
coinLidHeight = baseWidth - 1;
notchHeight = 4;
// Tolerance between the bank and the coin lid
coinLidTolerance = 0.15;
// If enabled, bridges the gaps between letters so the body is one sealed piece
fillGaps = true;
// How far up the cap height the gap-filling band reaches (0..1). Keep this
// well under 1 so the rounded letter tops stay proud of the band instead of
// being flattened into a straight edge.
gapsBandFraction = 0.5;


/* [Hidden] */
$fn = 100;
offsetDecrease = 2;  // Wall thickness of the hollow body
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
// from below; unmirrored it would come out backwards on the actual print.
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

// Name lid, printed face up so the raised name is on top.
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
`
