// Lighthouse Lamp - 3D printable, 250mm total
// Split parts: GOLD x2, WHITE x1, CLEAR glass x1
// Ignore Unilever logo
// Total height = 250mm exactly
// Preview shows assembled. Set EXPLODE >0 for exploded view.

$fn = 96;

TOTAL_H = 250;

// Stacking (mm)
BASE_H   = 6;
TOWER_H  = 150;
DECK_H   = 6;
LANTERN_H= 42;
ROOF_H   = 32;
// finial stem+ball = 14
// 6+150+6+42+32+14 = 250

Z0 = 0;
Z1 = Z0 + BASE_H;              // 6   top of base
Z2 = Z1 + TOWER_H;             // 156 top of tower
Z3 = Z2 + DECK_H;              // 162 top of deck floor
Z4 = Z3 + LANTERN_H;           // 204 top of lantern / bottom of roof
Z5 = Z4 + ROOF_H;              // 236 base of finial stem
// ball top = 250

// Diameters
BASE_D = 100;
TOWER_DB = 90;
TOWER_DT = 64;
WALL = 4;
DECK_D = 86;
RAIL_D = 80;
LANTERN_D = 62;
ROOF_D = 86;

GOLD = [0.78, 0.60, 0.28];
GOLD_DARK = [0.65, 0.48, 0.22];
CREAM = [0.96, 0.94, 0.88];
GLASS = [0.82, 0.92, 1.0];

EXPLODE = 0; // set to 40 for exploded view spacing

// helper: tower outer radius at height z (absolute)
function tower_R(z) = (TOWER_DB/2) + ((TOWER_DT/2 - TOWER_DB/2) * ((z - Z1)/TOWER_H));

module part_base_gold(dz=0) {
  translate([0,0,dz])
  color(GOLD)
  union() {
    // main base disc with chamfer
    cylinder(d=BASE_D, h=2.5);
    translate([0,0,2.5]) cylinder(d1=BASE_D, d2=BASE_D-4, h=2);
    translate([0,0,BASE_H-1.5]) cylinder(d=BASE_D-4, h=1.5);
    // locating socket for tower (ring)
    translate([0,0,BASE_H-1.5])
      difference() {
        cylinder(d=TOWER_DB+2, h=3.5);
        translate([0,0,1]) cylinder(d=TOWER_DB-2*WALL-1, h=4);
      }
  }
}

module part_tower_white(dz=0) {
  translate([0,0,dz])
  color(CREAM)
  difference() {
    // outer tapered tower
    translate([0,0,Z1]) cylinder(d1=TOWER_DB, d2=TOWER_DT, h=TOWER_H);
    // hollow interior (open top/bottom) for LED puck / tea light
    translate([0,0,Z1-1]) cylinder(d1=TOWER_DB-2*WALL, d2=TOWER_DT-2*WALL, h=TOWER_H+2);
    // windows - front (+Y), 3x as in photo
    // lower two
    translate([0, tower_R(Z1+28), Z1+28]) cube([13, 24, 22], center=true);
    translate([0, tower_R(Z1+58), Z1+58]) cube([13, 24, 22], center=true);
    // upper one
    translate([0, tower_R(Z1+118), Z1+118]) cube([13, 24, 22], center=true);
  }
}

module part_deck_rail_gold(dz=0) {
  translate([0,0,dz])
  color(GOLD)
  union() {
    // collar under deck (sits into tower top)
    translate([0,0,Z2-4]) cylinder(d=TOWER_DT-2*WALL+1.5, h=5);
    translate([0,0,Z2-2]) cylinder(d1=TOWER_DT+4, d2=TOWER_DT+8, h=4);
    // deck floor
    translate([0,0,Z2]) cylinder(d=DECK_D, h=DECK_H);
    // small drip edge under deck
    translate([0,0,Z2-0.5]) cylinder(d=DECK_D+2, h=1.5);
    // lantern bottom ring
    translate([0,0,Z3]) cylinder(d=70, h=4);

    // railing - 8 posts
    for(a=[0:45:315]) {
      rotate([0,0,a])
        translate([RAIL_D/2-2, 0, Z3])
          cylinder(d=3, h=24);
    }
    // railing - 2 horizontal rings (tube rings)
    for(z=[Z3+11, Z3+23]) {
      translate([0,0,z])
      difference() {
        cylinder(d=RAIL_D, h=2.4);
        translate([0,0,-0.5]) cylinder(d=RAIL_D-5, h=3.4);
      }
    }
    // lantern mullions - 4x, at 45deg so front view stays open
    for(a=[45,135,225,315]) {
      rotate([0,0,a])
        translate([LANTERN_D/2-1.5, 0, Z3+4])
          cylinder(d=4, h=LANTERN_H-4);
    }
    // lantern mid support where glass sits
    translate([0,0,Z3+4]) {
      difference() {
        cylinder(d=LANTERN_D+6, h=2);
        translate([0,0,-0.5]) cylinder(d=LANTERN_D-2, h=3);
      }
    }
  }
}

module part_glass_clear(dz=0) {
  translate([0,0,dz])
  color(GLASS)
  difference() {
    translate([0,0,Z3+4]) cylinder(d=LANTERN_D, h=LANTERN_H-4);
    translate([0,0,Z3+3]) cylinder(d=LANTERN_D-4, h=LANTERN_H-1);
  }
}

module part_roof_gold(dz=0) {
  translate([0,0,dz])
  color(GOLD)
  union() {
    // top ring that caps glass + mullions
    difference() {
      union() {
        translate([0,0,Z4-4]) cylinder(d=70, h=4);
        // cone roof with overhang
        translate([0,0,Z4]) cylinder(d1=ROOF_D, d2=10, h=ROOF_H);
        // eave lip
        translate([0,0,Z4-1]) cylinder(d=ROOF_D+2, h=2);
      }
      // recess to locate on mullions/glass
      translate([0,0,Z4-4.5]) cylinder(d=LANTERN_D-1, h=6);
    }
    // finial stem + ball = 14mm to reach 250 total
    translate([0,0,Z5]) cylinder(d=6, h=6);
    translate([0,0,Z5+11]) sphere(d=12);
  }
}

// ---------- ASSEMBLY ----------
e = EXPLODE;

part_base_gold(dz = 0);
part_tower_white(dz = 0);
part_deck_rail_gold(dz = e*1);
part_glass_clear(dz = e*2);
part_roof_gold(dz = e*3);
