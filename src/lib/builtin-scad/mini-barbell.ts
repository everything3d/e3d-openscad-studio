export const MINI_BARBELL_SCAD = String.raw`
// Mini barbell with bumper plates.
// A desk-size barbell (about 1:10) and a set of colour-coded bumper plates
// that slide on and off, so the bar can be loaded to match a lift.
//
// Plates print flat: the back is completely flat for the bed, and the face
// carries a raised rim, a decorative ring, a hub lip, a contrasting hub
// insert and the raised weight label. The bar is three parts: a shaft and two
// end pieces (collar + sleeve) that are glued onto the shaft's ends. The deep
// glue sockets keep the ends from drooping under the plates.
//
// showAssembled = false lays every part out flat, ready to slice.
// showAssembled = true shows the bar loaded with loadPerSide.

/* [Plates] */
// One row per plate: [label, overall thickness, plate colour, label colour, count]
plates = [
    ["25", 6.6, "#D62828", "#F2F2F2", 2],
    ["20", 5.8, "#1D4ED8", "#F2F2F2", 2],
    ["15", 5.0, "#FACC15", "#F2F2F2", 2],
    ["10", 4.2, "#16A34A", "#F2F2F2", 2],
    ["5", 3.4, "#F2F2F2", "#1A1A1A", 2]
];
unitLabel = "KG";
labelFont = "Bebas Neue"; // font
// 45 mm is a 450 mm bumper plate at 1:10
plateDiameter = 45;
numberHeight = 7.8;
unitHeight = 5;
// Raised heights above the plate face
labelHeight = 0.4;
rimWidth = 2;
rimHeight = 1.0;
ringWidth = 0.6;
ringHeight = 0.6;
// Hub insert around the hole, printed in the label colour
insertDiameter = 15.2;
insertHeight = 0.8;
lipWidth = 1.2;
lipHeight = 0.6;

/* [Bar] */
// Length between the two collars: the part the hands grip
gripLength = 86;
shaftDiameter = 4;
collarDiameter = 10.6;
collarLength = 4;
sleeveDiameter = 6.7;
// Sleeve length sets how many plates fit on each side
sleeveLength = 33;
// Depth of the glue socket in each end piece; deeper stops the ends drooping
socketDepth = 20;
// Extra socket diameter so the end slides onto the shaft before gluing
socketClearance = 0.5;
// Extra plate-hole diameter over the sleeve, so plates slide on and off
plateHoleClearance = 0.5;
// Flat along the shaft's underside so it prints lying down
shaftFlat = 0.3;
barColor = "#A8A9AD"; // color

/* [Layout] */
show = "all"; // [all, plates, bar]
showAssembled = false;
// Plates on each side in the assembled view, inner to outer (labels from plates)
loadPerSide = ["25", "20", "15", "10"];
// Gap between parts in the print layout
layoutGap = 3;

/* [Hidden] */
$fn = 96;
R = plateDiameter / 2;
holeD = sleeveDiameter + plateHoleClearance;
ringR = R - rimWidth - 1.5;
lipR = insertDiameter / 2 + lipWidth;
// The labels sit midway between the hub lip and the decorative ring
labelY = (lipR + ringR - ringWidth) / 2;
labelBand = ringR - ringWidth - lipR - 1;
socketD = shaftDiameter + socketClearance;
shaftLength = gripLength + 2 * (socketDepth - 0.5);
endLength = collarLength + sleeveLength;
sideCapacity = sleeveLength;

assert(holeD < insertDiameter - 2, "insertDiameter must leave at least 1 mm of insert around the plate hole.");
assert(lipR < ringR - ringWidth - 4, "The hub and the decorative ring leave no room for the label. Reduce insertDiameter or lipWidth.");
assert(socketD < sleeveDiameter - 1.6, "The socket leaves the sleeve wall thinner than 0.8 mm. Reduce socketClearance or raise sleeveDiameter.");
assert(socketDepth < endLength - 2, "socketDepth must stay at least 2 mm short of the end piece's length.");
for (p = plates) assert(p[1] > rimHeight + 1, str("Plate ", p[0], " is too thin for its rim."));

function plate_row(label) = [for (p = plates) if (p[0] == label) p][0];
for (label = loadPerSide) assert(!is_undef(plate_row(label)), str("loadPerSide names plate \"", label, "\", which is not in plates."));
function load_thickness(i) = i <= 0 ? 0 : plate_row(loadPerSide[i - 1])[1] + load_thickness(i - 1);
assert(load_thickness(len(loadPerSide)) <= sideCapacity,
       str("loadPerSide is ", load_thickness(len(loadPerSide)), " mm thick but the sleeve holds ", sideCapacity, " mm."));

module ring2d(r_in, r_out) {
    difference() { circle(r = r_out); circle(r = r_in); }
}

// Text scaled to an exact ink height and centred on its ink, not on the
// font's nominal box. Long labels are squeezed to fit maxWidth.
module fitted_text(value, height, maxWidth) {
    m = textmetrics(value, size = 10, font = labelFont, halign = "center", valign = "center");
    s = min(height / m.size.y, maxWidth / m.size.x);
    scale([s, s])
        translate([-(m.position.x + m.size.x / 2), -(m.position.y + m.size.y / 2)])
            text(value, size = 10, font = labelFont, halign = "center", valign = "center");
}

// One plate, flat back on z = 0, face up.
module plate(row) {
    t = row[1];
    face = t - rimHeight;
    color(row[2])
        difference() {
            union() {
                cylinder(r = R, h = face);
                translate([0, 0, face - 0.01]) {
                    linear_extrude(rimHeight + 0.01) ring2d(R - rimWidth, R);
                    linear_extrude(ringHeight + 0.01) ring2d(ringR - ringWidth, ringR);
                    linear_extrude(lipHeight + 0.01) ring2d(insertDiameter / 2, lipR);
                }
            }
            translate([0, 0, -1]) cylinder(d = holeD, h = t + 2);
        }
    color(row[3])
        translate([0, 0, face]) {
            linear_extrude(insertHeight) ring2d(holeD / 2, insertDiameter / 2);
            linear_extrude(labelHeight) {
                translate([0, labelY]) fitted_text(row[0], numberHeight, labelBand * 1.2);
                translate([0, -labelY]) fitted_text(unitLabel, unitHeight, labelBand * 1.2);
            }
        }
}

// Shaft centred on its axis along X, with the print flat on its underside.
module shaft() {
    color(barColor)
        difference() {
            rotate([0, 90, 0]) cylinder(d = shaftDiameter, h = shaftLength, center = true);
            translate([0, 0, -shaftDiameter / 2 - 1 + shaftFlat])
                cube([shaftLength + 2, shaftDiameter + 2, 2], center = true);
        }
}

// End piece standing on its collar, socket opening at z = 0.
module bar_end() {
    color(barColor)
        difference() {
            union() {
                cylinder(d = collarDiameter, h = collarLength);
                cylinder(d = sleeveDiameter, h = endLength);
            }
            translate([0, 0, -0.01]) cylinder(d = socketD, h = socketDepth + 0.01);
        }
}

module print_layout() {
    pitch = plateDiameter + layoutGap;
    copies = [for (p = plates) if (p[4] > 0) for (k = [1 : p[4]]) p];
    cols = max(1, min(5, len(copies)));
    if (show != "bar" && len(copies) > 0)
        for (i = [0 : len(copies) - 1])
            translate([(i % cols) * pitch, -floor(i / cols) * pitch, 0]) plate(copies[i]);
    rows = show == "bar" ? 0 : ceil(len(copies) / cols);
    barY = -(rows - 0.5) * pitch - layoutGap - collarDiameter / 2;
    if (show != "plates") {
        translate([shaftLength / 2 - R, barY, shaftDiameter / 2 - shaftFlat]) shaft();
        for (k = [0, 1])
            translate([-R + collarDiameter / 2 + k * (collarDiameter + layoutGap),
                       barY - collarDiameter - layoutGap, 0])
                bar_end();
    }
}

// Bar along X at plate-radius height, so the loaded plates rest on the table.
module assembled() {
    axisZ = R;
    translate([0, 0, axisZ]) {
        if (show != "plates") {
            shaft();
            translate([gripLength / 2, 0, 0]) rotate([0, 90, 0]) bar_end();
            translate([-gripLength / 2, 0, 0]) rotate([0, -90, 0]) bar_end();
        }
        if (show != "bar" && len(loadPerSide) > 0)
            for (i = [0 : len(loadPerSide) - 1]) {
                row = plate_row(loadPerSide[i]);
                x = gripLength / 2 + collarLength + load_thickness(i) + 0.2 * i;
                // Flat back against the collar, label facing out and upright
                translate([x, 0, 0]) rotate([0, 90, 0]) rotate([0, 0, 90]) plate(row);
                translate([-x, 0, 0]) rotate([0, -90, 0]) rotate([0, 0, -90]) plate(row);
            }
    }
}

if (showAssembled) assembled(); else print_layout();
`
