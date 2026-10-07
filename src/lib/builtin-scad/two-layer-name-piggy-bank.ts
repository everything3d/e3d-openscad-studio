export const TWO_LAYER_NAME_PIGGY_BANK_SCAD = String.raw`
// Two-layer name piggy bank.
// A hollow coin bank cut to the outline of a name, with a coin slot in the
// back and a removable twist-lock coin lid underneath. The name lid on top
// prints in two colours: the plate and the raised name.
//
// mode = "print" lays every part out flat, ready to slice.
// mode = "preview" shows the name lid upright, as it looks on the shelf.
mode = "print";  // [preview, print]
name = "Kiara";
font = "Baby Donuts"; // font
textSize = 40;
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
// Colour of the raised name
fontColor = "#F39237"; // color

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
text_width = metrics.size.x;
text_height = metrics.size.y;
descent = -metrics.descent;
ascent = metrics.ascent;
position = metrics.position;
half_text_width = text_width / 2;
x_translation = -half_text_width - position.x;
y_translation = -textSize * 2 - 5 + position.y;

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
        // Raised name above the plate
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
