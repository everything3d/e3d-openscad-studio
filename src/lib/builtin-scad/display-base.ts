interface DisplayBaseDefaults {
  summary: string
  line1: string
  line2: string
  line3: string
  font1: string
  font2: string
  size1: number
  size2: number
  showHeart: boolean
  twoSided: boolean
  baseWidth: number
  baseDepth: number
  baseHeight: number
  faceSetback: number
}

/**
 * The display bases share one program: a wedge with a sloped front face that
 * carries a separately printed plaque in a support-free recessed pocket. Only
 * the defaults differ between the catalog entries built from it.
 */
function displayBaseScad(d: DisplayBaseDefaults): string {
  const str = (value: string) => JSON.stringify(value)
  return String.raw`
${d.summary}
// The plaque prints flat and separately, so its lettering comes out crisp in
// a second colour, then drops into a chamfered pocket on the sloped face.
//
// show_assembled = false lays the base and plaque out flat, ready to slice.
// show_assembled = true shows the plaque fitted into the base.

/* [Plaque text] */
// Up to three centred lines. Leave a line empty to hide it.
line1 = ${str(d.line1)};
line2 = ${str(d.line2)};
line3 = ${str(d.line3)};
font1 = ${str(d.font1)}; // font
// Font for lines 2 and 3
font2 = ${str(d.font2)}; // font
size1 = ${d.size1};
// Size for lines 2 and 3
size2 = ${d.size2};
// Vertical space between lines
line_gap = 2.4;
// Lines shrink to fit the plaque width, keeping this clear margin each side
text_side_margin = 4;
text_raise = 0.85;
// Thickens thin strokes so small text prints cleanly
font_boldening = 0.12;

/* [Heart] */
// A modelled heart after line 1, so it never depends on an emoji glyph
show_heart = ${d.showHeart};
heart_width = 7.4;
heart_height = 5.2;
heart_gap = 2.2;

/* [Base] */
base_width = ${d.baseWidth};
base_depth = ${d.baseDepth};
base_height = ${d.baseHeight};
// How far the top of the sloped face is set back from the front edge.
// A larger setback reclines the face and makes the plaque taller.
face_setback = ${d.faceSetback};
// Adds a matching sloped face and blank plaque on the back
two_sided = ${d.twoSided};

/* [Colors] */
base_color = "#1F1F1F"; // color
plaque_color = "#1F1F1F"; // color
line1_color = "#FFFFFF"; // color
line2_color = "#E9C46A"; // color
heart_color = "#E63946"; // color

/* [Plaque fit] */
recess_side_margin = 1.5;
recess_top_bottom_margin = 0.7;
recess_depth = 1.7;
recess_chamfer = 0.8;
recess_corner_r = 2.4;
// Gap between plaque and pocket on every side; raise it if the fit is tight
plaque_clearance = 0.35;
plaque_thickness = 1.5;

/* [Preview] */
show_assembled = false;

/* [Hidden] */
$fn = 72;
heart_segments = 120;

slope_len = sqrt(face_setback * face_setback + base_height * base_height);
recess_w = base_width - 2 * recess_side_margin;
recess_h = slope_len - 2 * recess_top_bottom_margin;
inner_recess_w = recess_w - 2 * recess_chamfer;
inner_recess_h = recess_h - 2 * recess_chamfer;
inner_corner_r = recess_corner_r - recess_chamfer;
plaque_w = inner_recess_w - 2 * plaque_clearance;
plaque_h = inner_recess_h - 2 * plaque_clearance;
plaque_corner_r = inner_corner_r - plaque_clearance;

// [text, size, font, colour] for each visible line, top to bottom.
lines = [
    for (l = [[line1, size1, font1, line1_color],
              [line2, size2, font2, line2_color],
              [line3, size2, font2, line2_color]])
        if (l[0] != "") l
];
metrics = [
    for (l = lines)
        textmetrics(l[0], size = l[1], font = l[2], halign = "center", valign = "center")
];
heart_space = show_heart ? heart_gap + heart_width : 0;
max_text_w = plaque_w - 2 * text_side_margin;
// Line 1 shares its row with the heart, so it gets less width.
scales = [
    for (i = [0 : len(lines) - 1])
        let(avail = max_text_w - (i == 0 ? heart_space : 0),
            ink_w = metrics[i].size.x + 2 * font_boldening)
        min(1, avail / ink_w)
];
inks = [for (i = [0 : len(lines) - 1]) metrics[i].size.y * scales[i]];
block_h = sum(inks) + line_gap * (len(lines) - 1);
row_y = [
    for (i = [0 : len(lines) - 1])
        block_h / 2 - sum([for (j = [0 : i]) inks[j]]) - line_gap * i + inks[i] / 2
];

function sum(v) = len(v) == 0 ? 0 : v[0] + sum([for (i = [1 : 1 : len(v) - 1]) v[i]]);

assert(len(lines) > 0, "Set at least one of line1, line2 or line3.");
assert(plaque_w > 0 && plaque_h > 0 && plaque_corner_r > 0,
       "The plaque has no room: enlarge the base or reduce the recess margins and chamfer.");
assert(block_h <= plaque_h - 1,
       str("The text is ", block_h, "mm tall but the plaque is only ", plaque_h,
           "mm. Reduce the text sizes or line_gap, or raise face_setback/base_height."));

module rounded_rectangle(w, h, r) {
    offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}

// Wedge body with a sloped plaque face at the front, and at the back too
// when two_sided is on.
module wedge() {
    x0 = -base_width / 2; x1 = base_width / 2;
    yf = -base_depth / 2; yb = base_depth / 2;
    yft = yf + face_setback;
    ybt = two_sided ? yb - face_setback : yb;
    polyhedron(
        points = [[x0, yf, 0], [x1, yf, 0], [x1, yb, 0], [x0, yb, 0],
                  [x0, yft, base_height], [x1, yft, base_height],
                  [x1, ybt, base_height], [x0, ybt, base_height]],
        faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5],
                 [2, 3, 7, 6], [3, 0, 4, 7]]
    );
}

// Local axes on a sloped face: X = across, Y = up the face, Z = into the base.
// side = -1 is the front; side = 1 is the back.
module on_face(side = -1, start_outward = 0) {
    center_y = side * (base_depth / 2 - face_setback / 2);
    out_y = side * base_height / slope_len;
    out_z = face_setback / slope_len;
    up_y = -side * face_setback / slope_len;
    up_z = base_height / slope_len;
    multmatrix([
        [1, 0, 0, 0],
        [0, up_y, -out_y, center_y + start_outward * out_y],
        [0, up_z, -out_z, base_height / 2 + start_outward * out_z],
        [0, 0, 0, 1]
    ]) children();
}

// The tapered entry avoids a sharp, unsupported lip at the top of the pocket.
module chamfered_recess_cutter() {
    hull() {
        translate([0, 0, -0.10]) linear_extrude(height = 0.10)
            rounded_rectangle(recess_w, recess_h, recess_corner_r);
        translate([0, 0, recess_chamfer]) linear_extrude(height = 0.02)
            rounded_rectangle(inner_recess_w, inner_recess_h, inner_corner_r);
    }
    translate([0, 0, recess_chamfer])
        linear_extrude(height = recess_depth - recess_chamfer + 0.15)
            rounded_rectangle(inner_recess_w, inner_recess_h, inner_corner_r);
}

module recessed_base() {
    color(base_color) difference() {
        wedge();
        on_face(-1) chamfered_recess_cutter();
        if (two_sided) on_face(1) chamfered_recess_cutter();
    }
}

// Smooth, font-independent heart, centred on the origin.
module heart_2d(w, h) {
    scale([w / 32, h / 30])
        translate([0, 2])
            polygon([
                for (i = [0 : heart_segments])
                    let(a = 360 * i / heart_segments)
                    [16 * pow(sin(a), 3),
                     13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a)]
            ]);
}

// One line of text centred on its ink rather than the font's nominal box.
module line_2d(i) {
    m = metrics[i];
    offset(delta = font_boldening)
        scale([scales[i], scales[i]])
            translate([-(m.position.x + m.size.x / 2), -(m.position.y + m.size.y / 2)])
                text(lines[i][0], size = lines[i][1], font = lines[i][2],
                     halign = "center", valign = "center");
}

module plaque_artwork() {
    for (i = [0 : len(lines) - 1]) {
        // The heart sits after line 1; the pair is centred together.
        row_w = metrics[i].size.x * scales[i] + (i == 0 ? heart_space : 0);
        line_x = i == 0 ? -row_w / 2 + metrics[i].size.x * scales[i] / 2 : 0;
        color(lines[i][3])
            translate([line_x, row_y[i]])
                linear_extrude(height = text_raise) line_2d(i);
        if (i == 0 && show_heart)
            color(heart_color)
                translate([row_w / 2 - heart_width / 2, row_y[0]])
                    linear_extrude(height = text_raise) heart_2d(heart_width, heart_height);
    }
}

module plaque_plate() {
    linear_extrude(height = plaque_thickness)
        rounded_rectangle(plaque_w, plaque_h, plaque_corner_r);
}

module installed_plaques() {
    color(plaque_color) on_face(-1, start_outward = 0.05) plaque_plate();
    on_face(-1, start_outward = 0.08)
        mirror([0, 0, 1]) plaque_artwork();
    if (two_sided)
        color(plaque_color) on_face(1, start_outward = 0.05) plaque_plate();
}

// Flat, separate print layout: the lettered front plaque, plus a blank back
// plaque when two_sided is on.
module loose_plaques() {
    front_y = -base_depth / 2 - plaque_h / 2 - 10;
    translate([0, front_y, 0]) {
        color(plaque_color) plaque_plate();
        translate([0, 0, plaque_thickness]) plaque_artwork();
    }
    if (two_sided)
        color(plaque_color)
            translate([0, base_depth / 2 + plaque_h / 2 + 10, 0]) plaque_plate();
}

recessed_base();
if (show_assembled) installed_plaques(); else loose_plaques();
`
}

export const FIGURINE_DISPLAY_BASE_SCAD = displayBaseScad({
  summary: `// Figurine display base.
// A low wedge with a flat top for a figurine and a sloped front face carrying
// a name plaque, with an optional heart and an optional matching back face.`,
  line1: 'Arjun',
  line2: '',
  line3: '',
  font1: 'Poppins',
  font2: 'Poppins',
  size1: 6.4,
  size2: 4,
  showHeart: true,
  twoSided: false,
  baseWidth: 110,
  baseDepth: 90,
  baseHeight: 15,
  faceSetback: 9,
})

export const AWARD_PLAQUE_BASE_SCAD = displayBaseScad({
  summary: `// Award plaque base.
// A wide wedge with a reclined front face that carries a three-line plaque:
// a name, a dedication and a closing line. Works as a trophy or figurine base.`,
  line1: 'Dr. Meera Iyer',
  line2: 'Best Teacher Award 2026',
  line3: 'With heartfelt gratitude',
  font1: 'Cinzel',
  font2: 'Lora',
  size1: 5.4,
  size2: 3.8,
  showHeart: false,
  twoSided: false,
  baseWidth: 130,
  baseDepth: 90,
  baseHeight: 18,
  faceSetback: 20,
})
