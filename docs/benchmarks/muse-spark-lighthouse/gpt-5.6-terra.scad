// 250 mm decorative lighthouse, arranged as separate gold and white printable components
// Print parts by color/group: white_tower(); white_lantern_core(); gold_details();
$fn = 72;

// Overall dimensions (mm)
total_height = 250;
body_h = 138;
body_bottom_r = 48;
body_top_r = 35;
base_h = 5;
front_y = -1;

// Palette
white_part = [0.94, 0.91, 0.83];
gold_part = [0.82, 0.52, 0.10];

// A tapered solid tower with three front-facing, gold-backed light apertures.
module white_tower() {
    color(white_part)
    difference() {
        translate([0,0,base_h])
            cylinder(h=body_h, r1=body_bottom_r, r2=body_top_r);

        // shallow rectangular window pockets, positioned on the front face
        for (zpos = [25, 63, 102])
            translate([12, -52, zpos])
                cube([15, 15, 24], center=true);
    }
}

// White lamp core: a separate, printable central element behind the open lantern.
module white_lantern_core() {
    color(white_part)
    union() {
        translate([0,0,151]) cylinder(h=47, r=16);
        translate([0,0,197]) sphere(r=16);
    }
}

module ring(z, r, h=3) {
    translate([0,0,z])
        difference() {
            cylinder(h=h, r=r);
            translate([0,0,-0.2]) cylinder(h=h+0.4, r=r-3);
        }
}

module gold_details() {
    color(gold_part)
    union() {
        // Separate foot and tower collar
        ring(0, 51, 4);
        ring(4, 48, 2);
        ring(140, 39, 5);
        ring(145, 42, 5);

        // Three window inlays sit flush inside the body pockets
        for (zpos = [25, 63, 102])
            translate([12, -46.0, zpos])
                cube([14.5, 2.2, 23.5], center=true);

        // Lantern floor, upper sill, and eight vertical mullions
        translate([0,0,149]) cylinder(h=4, r=39);
        ring(151, 43, 3);
        ring(198, 40, 3);
        for (a = [0:45:315])
            rotate([0,0,a])
                translate([34,0,153]) cylinder(h=46, r=2.1);

        // Gallery railing: two circular rails joined by regularly spaced posts
        ring(157, 48, 2.6);
        ring(173, 48, 2.6);
        ring(181, 48, 2.6);
        for (a = [0:30:330])
            rotate([0,0,a])
                translate([45,0,157]) cylinder(h=25, r=1.8);

        // Projecting underside of gallery
        ring(151, 48, 4);

        // Roof, top rim, and finial. Highest point = 250 mm.
        translate([0,0,201]) cylinder(h=3, r=42);
        translate([0,0,204]) cylinder(h=32, r1=41, r2=7);
        translate([0,0,235]) cylinder(h=5, r=5);
        translate([0,0,243]) sphere(r=7);
    }
}

white_tower();
white_lantern_core();
gold_details();
