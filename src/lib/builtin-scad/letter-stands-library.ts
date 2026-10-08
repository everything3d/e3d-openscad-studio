// letter-stands.scad: the approved stand geometry the letter pen stand starter
// ships as a workspace file, so the program the agent edits stays small.
export const LETTER_STANDS_LIBRARY_SCAD = String.raw`
// Approved serif-letter pen stands, one module per letter, all 127 mm high
// with the front facing -Y. Library only: no top-level geometry.
// selected_stand(letter) picks one; the letters missing here have no stand.

module stand_A() {
    // Serif-A pen stand. Dimensions in mm. Front faces -Y.
    // Name removed; stand geometry preserved.
    $fn = 72;
    stand_width = 136;
    stand_height = 127;
    letter_depth = 12;
    pocket_height = 69;
    pocket_depth = 26;
    pocket_wall = 2.4;
    pocket_floor = 4;
    pocket_overlap = 2;
    left_foot_height = 4;
    extend_left_foot = true;
    body_color = [0.015, 0.48, 0.70];
    sx = stand_width/136;
    sz = stand_height/127;
    pocket_front = letter_depth/2-pocket_overlap;
    pocket_rear = pocket_front+pocket_depth;
    eps = 0.02;
    function bezier(a,b,c,n=16) = [for(i=[0:n])
        let(t=i/n) [(1-t)*(1-t)*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
                   (1-t)*(1-t)*a[1]+2*(1-t)*t*b[1]+t*t*c[1]]];
    function right_outer(z) = 51+(10-51)*(z-20)/(127-20);
    function right_inner(z) = 20*(101-z)/(101-52);
    module a_profile() {
        scale([sx,sz]) difference() {
            polygon(concat(
                [[-68,0],[-25,0],[-25,4]],
                bezier([-25,4],[-38,7],[-32,21]),
                [[-23,44],[23,44],[32,21]],
                bezier([32,21],[38,7],[25,4]),
                [[25,0],[68,0],[68,4]],
                bezier([68,4],[57,5],[51,20]),
                [[10,127],[-10,127],[-51,20]],
                bezier([-51,20],[-57,5],[-68,4])
            ));
            polygon([[-20,52],[20,52],[0,101]]);
        }
    }
    module depth_extrude(y_start, depth) {
        translate([0,y_start+depth,0]) rotate([90,0,0])
            linear_extrude(height=depth, convexity=10) children();
    }
    module initial_body() {
        depth_extrude(-letter_depth/2,letter_depth) a_profile();
    }
    module right_leg_profile(height) {
        h = height/sz;
        assert(h > 52 && h < 101,
               "Pocket height must lie between the crossbar and upper counter tip.");
        scale([sx,sz]) polygon(concat(
            [[25,0],[25,4]],
            bezier([25,4],[38,7],[32,21]),
            [[23,44],[20,52],
             [right_inner(h),h],[right_outer(h),h],[51,20]],
            bezier([51,20],[57,5],[68,4]),
            [[68,0]]
        ));
    }
    module pocket_outer() {
        depth_extrude(pocket_front,pocket_depth) right_leg_profile(pocket_height);
    }
    module pocket_void() {
        depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
            intersection() {
                offset(delta=-pocket_wall) right_leg_profile(pocket_height+3*pocket_wall);
                translate([-stand_width,pocket_floor])
                    square([2*stand_width,pocket_height-pocket_floor+eps]);
            }
    }
    module left_foot_extension() {
        depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2)
            intersection() {
                a_profile();
                translate([-stand_width,0]) square([stand_width,left_foot_height]);
            }
    }
    module stand() {
        color(body_color) difference() {
            union() {
                initial_body();
                pocket_outer();
                if (extend_left_foot) left_foot_extension();
            }
            pocket_void();
        }
    }
    stand();
}

module stand_B() {
    // Custom serif silhouette; dimensions in mm, no font dependencies.
    stand_height = 127;
    curve_steps = 48;
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    
    module b_profile() {
     scale([1,stand_height/127]) {
    difference() {
     polygon(concat([[ -50,0],[-50,4]],
     cubic([-50,4],[-38,5],[-34,8],[-34,21]),
     [[-34,106]],
     cubic([-34,106],[-34,119],[-38,122],[-50,123]),
     [[-50,127],[-8,127]],
     cubic([-8,127],[26,127],[44,118],[44,98]),
     cubic([44,98],[44,82],[33,70],[14,66]),
     cubic([14,66],[37,63],[50,53],[50,33]),
     cubic([50,33],[50,10],[28,0],[-5,0])
     ));
     polygon(concat([[-12,116],[-12,73],[-4,73]],
     cubic([-4,73],[17,73],[23,82],[23,96]),
     cubic([23,96],[23,111],[12,116],[-12,116])));
     polygon(concat([[-12,61],[-12,11],[-4,11]],
     cubic([-4,11],[20,11],[28,19],[28,35]),
     cubic([28,35],[28,51],[19,61],[-4,61])));
    }
     }
    }
    
    // Rear pen pocket, front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
     intersection() { b_profile(); translate([-60,0]) square([48,h]); }
    }
    module cavity() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
     offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
     translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+0.02]);
     }
    }
    color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) b_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Rear extension of the low silhouette balances the footprint.
     depth_extrude(-6,36) intersection() { b_profile(); translate([-100,0]) square([200,4]); }
     
     }
     cavity();
    }
}

module stand_C() {
    // Custom serif silhouette; dimensions in mm, no font dependencies.
    stand_height = 127;
    curve_steps = 48;
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    
    module c_profile() {
     scale([1,stand_height/127]) {
    polygon(concat(
     [[45,127],[45,88],[39,88]],
     cubic([39,88],[34,108],[21,116],[4,116]),
     cubic([4,116],[-19,116],[-29,95],[-29,64]),
     cubic([-29,64],[-29,30],[-16,11],[7,11]),
     cubic([7,11],[23,11],[35,21],[41,38]),
     [[49,34]],
     cubic([49,34],[42,11],[27,0],[4,0]),
     cubic([4,0],[-31,0],[-51,25],[-51,63]),
     cubic([-51,63],[-51,103],[-30,127],[3,127]),
     cubic([3,127],[17,127],[29,123],[36,117]),
     [[40,127]]));
     }
    }
    
    // Rear pen pocket, front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
     intersection() { c_profile(); translate([-60,0]) square([68,h]); }
    }
    module cavity() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
     offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
     translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+0.02]);
     }
    }
    color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) c_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Rear extension of the low silhouette balances the footprint.
     depth_extrude(-6,36) intersection() { c_profile(); translate([-100,0]) square([200,4]); }
     depth_extrude(4,26) translate([-18,0]) square([36,4]);
     }
     cavity();
    }
}

module stand_D() {
    // Custom serif silhouette; dimensions in mm, no font dependencies.
    stand_height = 127;
    curve_steps = 48;
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    
    module d_profile() {
     scale([1,stand_height/127]) {
    difference() {
     polygon(concat([[ -50,0],[-50,4]],
     cubic([-50,4],[-38,5],[-34,8],[-34,21]),
     [[-34,106]],
     cubic([-34,106],[-34,119],[-38,122],[-50,123]),
     [[-50,127],[-8,127]],
     cubic([-8,127],[31,127],[52,106],[52,65]),
     cubic([52,65],[52,23],[29,0],[-8,0])
     ));
     polygon(concat([[-12,116],[-12,11],[-5,11]],
     cubic([-5,11],[19,11],[29,29],[29,64]),
     cubic([29,64],[29,98],[19,116],[-5,116])));
    }
     }
    }
    
    // Rear pen pocket, front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
     intersection() { d_profile(); translate([-60,0]) square([48,h]); }
    }
    module cavity() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
     offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
     translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+0.02]);
     }
    }
    color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) d_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Rear extension of the low silhouette balances the footprint.
     depth_extrude(-6,36) intersection() { d_profile(); translate([-100,0]) square([200,4]); }
     
     }
     cavity();
    }
}

module stand_G() {
    // Custom serif silhouette; dimensions in mm, no font dependencies.
    stand_height = 127;
    curve_steps = 48;
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    
    module g_profile() {
     scale([1,stand_height/127]) union() {
    polygon(concat(
     [[45,127],[45,88],[39,88]],
     cubic([39,88],[34,108],[21,116],[4,116]),
     cubic([4,116],[-19,116],[-29,95],[-29,64]),
     cubic([-29,64],[-29,30],[-16,11],[7,11]),
     cubic([7,11],[16,11],[24,15],[29,21]),
     [[29,46]],
     cubic([29,46],[29,56],[24,59],[15,60]),
     [[15,64],[56,64],[56,60]],
     cubic([56,60],[48,59],[48,56],[48,46]),
     [[48,10],[42,10],[37,17]],
     cubic([37,17],[28,5],[17,0],[4,0]),
     cubic([4,0],[-31,0],[-51,25],[-51,63]),
     cubic([-51,63],[-51,103],[-30,127],[3,127]),
     cubic([3,127],[17,127],[29,123],[36,117]),
     [[40,127]]));
    // Bring the right stem to the baseline with a bracketed serif foot.
    polygon(concat(
     [[29,24],[48,24],[48,20]],
     cubic([48,20],[48,8],[53,5],[60,4]),
     [[60,0],[17,0],[17,4]],
     cubic([17,4],[29,5],[29,9],[29,20])
    ));
     }
    }
    
    // Rear pen pocket, front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=52;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
     intersection() { g_profile(); translate([17,0]) square([48,h]); }
    }
    module cavity() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
     offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
     translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+0.02]);
     }
    }
    color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) g_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Rear extension of the low silhouette balances the footprint.
     depth_extrude(-6,36) intersection() { g_profile(); translate([-100,0]) square([200,4]); }
     depth_extrude(4,26) translate([-18,0]) square([36,4]);
     }
     cavity();
    }
}

module stand_H() {
    // Custom bracketed serif silhouette. Dimensions in mm; no pocket yet.
    // Font independent curves; 127 mm reference height.
    stand_height = 127;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
     u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(x,w=24,foot=12,top=true,bottom=true) {
     translate([x,0]) union() {
      translate([-w/2,0]) square([w,127]);
      if(bottom) polygon(concat([[-w/2-foot,0],[w/2+foot,0],[w/2+foot,4]],
       bezier([w/2+foot,4],[w/2,5],[w/2,21]),[[-w/2,21]],
       bezier([-w/2,21],[-w/2,5],[-w/2-foot,4])));
      if(top) polygon(concat([[-w/2-foot,127],[w/2+foot,127],[w/2+foot,123]],
       bezier([w/2+foot,123],[w/2,122],[w/2,106]),[[-w/2,106]],
       bezier([-w/2,106],[-w/2,122],[-w/2-foot,123])));
     }
    }
    
    silhouette_width = 128;
    module h_profile() {
     scale([silhouette_width/128,stand_height/127]) union() { stem(-40); stem(40); translate([-40,55]) square([80,15]); }
    }
    
    // Pen stand: front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) { intersection() { stem(40); translate([-150,0]) square([300,h]); } }
    module pocket_void() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
      offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
      translate([-150,pocket_floor]) square([300,pocket_height-pocket_floor+0.02]);
     }
    }
    module stand() {
     color([0.015,0.48,0.70]) difference() {
      union() {
       depth_extrude(-letter_depth/2,letter_depth) h_profile();
       depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
       // Carry the low base rearward for a broad, stable support footprint.
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection() { h_profile(); translate([-150,0]) square([300,4]); }
       
      }
      pocket_void();
     }
    }
    stand();
}

module stand_J() {
    // Custom bracketed serif silhouette. Dimensions in mm; no pocket yet.
    // Font independent curves; 127 mm reference height.
    stand_height = 127;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
     u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(x,w=24,foot=12,top=true,bottom=true) {
     translate([x,0]) union() {
      translate([-w/2,0]) square([w,127]);
      if(bottom) polygon(concat([[-w/2-foot,0],[w/2+foot,0],[w/2+foot,4]],
       bezier([w/2+foot,4],[w/2,5],[w/2,21]),[[-w/2,21]],
       bezier([-w/2,21],[-w/2,5],[-w/2-foot,4])));
      if(top) polygon(concat([[-w/2-foot,127],[w/2+foot,127],[w/2+foot,123]],
       bezier([w/2+foot,123],[w/2,122],[w/2,106]),[[-w/2,106]],
       bezier([-w/2,106],[-w/2,122],[-w/2-foot,123])));
     }
    }
    
    silhouette_width = 90;
    module j_profile() {
     scale([silhouette_width/90,stand_height/127]) union() { translate([0,0]) polygon(concat([[17,127],[40,127],[40,39]], cubic([40,39],[40,12],[25,0],[2,0]), cubic([2,0],[-22,0],[-38,12],[-38,30]), cubic([-38,30],[-38,42],[-20,43],[-18,30]), cubic([-18,30],[-16,19],[-12,9],[0,9]), cubic([0,9],[12,9],[17,18],[17,38]))); translate([28.5,0]) polygon(concat([[-23.5,127],[23.5,127],[23.5,123]], bezier([23.5,123],[11.5,122],[11.5,106]),[[-11.5,106]], bezier([-11.5,106],[-11.5,122],[-23.5,123]))); }
    }
    
    // Pen stand: front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) { intersection() { j_profile(); square([100,h]); } }
    module pocket_void() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
      offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
      translate([-150,pocket_floor]) square([300,pocket_height-pocket_floor+0.02]);
     }
    }
    module stand() {
     color([0.015,0.48,0.70]) difference() {
      union() {
       depth_extrude(-letter_depth/2,letter_depth) j_profile();
       depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
       // Carry the low base rearward for a broad, stable support footprint.
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection() { j_profile(); translate([-150,0]) square([300,4]); }
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) { translate([-12,0]) square([36,4]); }
      }
      pocket_void();
     }
    }
    stand();
}

module stand_L() {
    // Custom bracketed serif silhouette. Dimensions in mm; no pocket yet.
    // Font independent curves; 127 mm reference height.
    stand_height = 127;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
     u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(x,w=24,foot=12,top=true,bottom=true) {
     translate([x,0]) union() {
      translate([-w/2,0]) square([w,127]);
      if(bottom) polygon(concat([[-w/2-foot,0],[w/2+foot,0],[w/2+foot,4]],
       bezier([w/2+foot,4],[w/2,5],[w/2,21]),[[-w/2,21]],
       bezier([-w/2,21],[-w/2,5],[-w/2-foot,4])));
      if(top) polygon(concat([[-w/2-foot,127],[w/2+foot,127],[w/2+foot,123]],
       bezier([w/2+foot,123],[w/2,122],[w/2,106]),[[-w/2,106]],
       bezier([-w/2,106],[-w/2,122],[-w/2-foot,123])));
     }
    }
    
    silhouette_width = 94;
    module l_profile() {
     scale([silhouette_width/94,stand_height/127]) union() { stem(-23,24,12,true,true); polygon(concat([[-23,0],[47,0],[47,38],[41,38]], cubic([41,38],[39,15],[31,8],[14,8]),[[-23,8]])); }
    }
    
    // Pen stand: front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) { intersection() { stem(-23); translate([-150,0]) square([300,h]); } }
    module pocket_void() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
      offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
      translate([-150,pocket_floor]) square([300,pocket_height-pocket_floor+0.02]);
     }
    }
    module stand() {
     color([0.015,0.48,0.70]) difference() {
      union() {
       depth_extrude(-letter_depth/2,letter_depth) l_profile();
       depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
       // Carry the low base rearward for a broad, stable support footprint.
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection() { l_profile(); translate([-150,0]) square([300,4]); }
       
      }
      pocket_void();
     }
    }
    stand();
}

module stand_M() {
    // Serif-M pen stand, matching the A series. Dimensions in mm.
    // Front faces -Y. No name or lettering overlay.
    $fn = 72;
    stand_width = 152;
    stand_height = 127;
    letter_depth = 12;
    pocket_height = 69;
    pocket_depth = 26;
    pocket_wall = 2.4;
    pocket_floor = 4;
    pocket_overlap = 2;
    left_foot_height = 4;
    extend_left_foot = true;
    body_color = [0.015, 0.48, 0.70];
    sx = stand_width/152;
    sz = stand_height/127;
    pocket_front = letter_depth/2-pocket_overlap;
    pocket_rear = pocket_front+pocket_depth;
    eps = 0.02;
    
    function bezier(a,b,c,n=16) = [for(i=[0:n])
        let(t=i/n) [(1-t)*(1-t)*a[0]+2*(1-t)*t*b[0]+t*t*c[0],
                   (1-t)*(1-t)*a[1]+2*(1-t)*t*b[1]+t*t*c[1]]];
    
    // Upright right stem with curved, flared serifs matching the A's feet.
    // Reused for the pocket so its outline continues the letter exactly.
    module right_stem_profile(height) {
        h = height/sz;
        assert(h > 21 && h <= 127, "Stem height must be between 21 and 127 scaled mm.");
        scale([sx,sz]) polygon(concat(
            [[24,0],[76,0],[76,4]],
            bezier([76,4],[60,5],[60,21]),
            [[60,h],[36,h],[36,21]],
            bezier([36,21],[36,7],[24,4])
        ));
    }
    
    module m_profile() {
        union() {
            right_stem_profile(stand_height);
            mirror([1,0,0]) right_stem_profile(stand_height);
            // Broad diagonal strokes and a low central V give a classic serif M.
            scale([sx,sz]) polygon([
                [-60,127],[-36,127],[0,55],[36,127],
                [60,127],[10,27],[-10,27]
            ]);
            top_serif_profile();
            mirror([1,0,0]) top_serif_profile();
        }
    }
    
    // Bracketed upper serifs: thin tips sweep smoothly into the upright.
    // The inner curve joins the diagonal near the top of the M.
    module top_serif_profile() {
        scale([sx,sz]) polygon(concat(
            [[24,127],[76,127],[76,123]],
            bezier([76,123],[60,122],[60,106]),
            [[36,106]],
            bezier([36,106],[36,122],[24,123])
        ));
    }
    
    module depth_extrude(y_start, depth) {
        translate([0,y_start+depth,0]) rotate([90,0,0])
            linear_extrude(height=depth, convexity=10) children();
    }
    
    module pocket_void() {
        depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
            intersection() {
                // Extend first, then inset, keeping the pocket mouth open.
                offset(delta=-pocket_wall)
                    right_stem_profile(pocket_height+3*pocket_wall);
                translate([-stand_width,pocket_floor])
                    square([2*stand_width,pocket_height-pocket_floor+eps]);
            }
    }
    
    module left_foot_extension() {
        depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2)
            intersection() {
                m_profile();
                translate([-stand_width,0]) square([stand_width,left_foot_height]);
            }
    }
    
    module stand() {
        color(body_color) difference() {
            union() {
                depth_extrude(-letter_depth/2,letter_depth) m_profile();
                depth_extrude(pocket_front,pocket_depth)
                    right_stem_profile(pocket_height);
                if (extend_left_foot) left_foot_extension();
            }
            pocket_void();
        }
    }
    
    stand();
}

module stand_N() {
    // Custom bracketed serif silhouette. Dimensions in mm. Rear pen pocket included.
    // Font independent outline, matching the A/M/S family.
    stand_height = 127;
    silhouette_width = 128;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n])
     let(t=i/n,u=1-t) [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    module stem() {
     polygon(concat(
     [[-64,0],[-20,0],[-20,4]],
     bezier([-20,4],[-34,5],[-34,21]),
     [[-34,106]],
     bezier([-34,106],[-34,122],[-20,123]),
     [[-20,127],[-64,127],[-64,123]],
     bezier([-64,123],[-50,122],[-50,106]),
     [[-50,21]],
     bezier([-50,21],[-50,5],[-64,4])
     ));
    }
    module n_profile() {
     scale([silhouette_width/128,stand_height/127]) union() {
     stem(); mirror([1,0,0]) stem();
     polygon([[-50,127],[-28,127],[50,0],[28,0]]);
     }
    }
    
    // Front is -Y; the matching rear pocket is open at its upper edge.
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
    intersection(){ n_profile(); translate([-silhouette_width,0]) square([silhouette_width-20,h]); }
    }
    module pen_stand() {
     color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) n_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Low rear support continues the letter's existing base footprint.
     depth_extrude(-6,36) intersection() {
     n_profile(); translate([-silhouette_width,0]) square([2*silhouette_width,4]);
     }
     }
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection(){
     offset(delta=-pocket_wall) pocket_profile(pocket_height+12);
     translate([-silhouette_width,pocket_floor]) square([2*silhouette_width,pocket_height-pocket_floor+0.02]);
     }
     }
    }
    pen_stand();
}

module stand_P() {
    // Serif P pen stand. Dimensions in mm. Front faces -Y.
    $fn=96;
    stand_height=127;
    curve_steps=48;
    function cubic(a,b,c,d,n=curve_steps)=[for(i=[0:n]) let(t=i/n,u=1-t) [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(){ polygon(concat([[-54,0],[-2,0],[-2,4]],cubic([-2,4],[-18,5],[-18,12],[-18,21]),[[-18,106]],cubic([-18,106],[-18,119],[-11,122],[-2,123]),[[-2,127],[-54,127],[-54,123]],cubic([-54,123],[-38,122],[-38,116],[-38,106]),[[-38,21]],cubic([-38,21],[-38,8],[-44,5],[-54,4]))); }
    module bowl(){difference(){polygon(concat([[-30,127],[0,127]],cubic([0,127],[33,127],[48,114],[48,91]),cubic([48,91],[48,67],[29,57],[0,57]),[[-30,57]]));polygon(concat([[-18,116],[-1,116]],cubic([-1,116],[19,116],[26,106],[26,91]),cubic([26,91],[26,75],[18,68],[-1,68]),[[-18,68]]));}}
    module p_profile(){scale([1,stand_height/127]) union(){stem();bowl();}}
    
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    foot_height=4;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    eps=0.02;
    module depth_extrude(y_start,depth){translate([0,y_start+depth,0]) rotate([90,0,0]) linear_extrude(height=depth,convexity=10) children();}
    module pocket_profile(h){intersection(){p_profile(); translate([-80,0]) square([62,h]);}}
    module pocket_void(){depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall) intersection(){offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+eps]);}}
    module stand(){color([0.015,0.48,0.70]) difference(){union(){
     depth_extrude(-letter_depth/2,letter_depth) p_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Extend the existing low serifs to the rear for a level support footprint.
     depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection(){p_profile();translate([-100,0])square([200,foot_height]);}
    }pocket_void();}}
    stand();
}

module stand_R() {
    // Serif R pen stand. Dimensions in mm. Front faces -Y.
    $fn=96;
    stand_height=127;
    curve_steps=48;
    function cubic(a,b,c,d,n=curve_steps)=[for(i=[0:n]) let(t=i/n,u=1-t) [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(){ polygon(concat([[-54,0],[-2,0],[-2,4]],cubic([-2,4],[-18,5],[-18,12],[-18,21]),[[-18,106]],cubic([-18,106],[-18,119],[-11,122],[-2,123]),[[-2,127],[-54,127],[-54,123]],cubic([-54,123],[-38,122],[-38,116],[-38,106]),[[-38,21]],cubic([-38,21],[-38,8],[-44,5],[-54,4]))); }
    module bowl(){difference(){polygon(concat([[-30,127],[0,127]],cubic([0,127],[33,127],[48,114],[48,91]),cubic([48,91],[48,67],[29,57],[0,57]),[[-30,57]]));polygon(concat([[-18,116],[-1,116]],cubic([-1,116],[19,116],[26,106],[26,91]),cubic([26,91],[26,75],[18,68],[-1,68]),[[-18,68]]));}}
    module r_profile(){scale([1,stand_height/127]) union(){stem();bowl();polygon(concat([[-7,64],[16,64],[43,21]],cubic([43,21],[49,10],[52,5],[62,4]),[[62,0],[28,0],[28,4]],cubic([28,4],[36,6],[30,14],[25,23]),[[-1,64]]));}}
    
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    foot_height=4;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    eps=0.02;
    module depth_extrude(y_start,depth){translate([0,y_start+depth,0]) rotate([90,0,0]) linear_extrude(height=depth,convexity=10) children();}
    module pocket_profile(h){intersection(){r_profile(); translate([-80,0]) square([62,h]);}}
    module pocket_void(){depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall) intersection(){offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);translate([-100,pocket_floor]) square([200,pocket_height-pocket_floor+eps]);}}
    module stand(){color([0.015,0.48,0.70]) difference(){union(){
     depth_extrude(-letter_depth/2,letter_depth) r_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Extend the existing low serifs to the rear for a level support footprint.
     depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection(){r_profile();translate([-100,0])square([200,foot_height]);}
    }pocket_void();}}
    stand();
}

module stand_S() {
    // Serif S pen stand with the approved silhouette. Front faces -Y.
    $fn = 72;
    stand_height = 127;
    silhouette_width = 96;
    curve_steps = 48;
    letter_depth = 12;
    pocket_height = 60;
    pocket_depth = 26;
    pocket_wall = 2.4;
    pocket_floor = 4;
    pocket_overlap = 2;
    foot_height = 4;
    body_color = [0.015,0.48,0.70];
    pocket_front = letter_depth/2-pocket_overlap;
    pocket_rear = pocket_front+pocket_depth;
    eps = 0.02;
    sx = silhouette_width/96;
    
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n])
        let(t=i/n,u=1-t)
        [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
         u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    
    module s_profile() {
        scale([silhouette_width/96,stand_height/127])
        polygon(concat(
            [[45,127],[45,88],[39,88]],
            cubic([39,88],[35,110],[22,117],[5,117]),
            cubic([5,117],[-15,117],[-26,106],[-26,93]),
            cubic([-26,93],[-26,79],[-12,74],[9,65]),
            cubic([9,65],[34,55],[48,45],[48,27]),
            cubic([48,27],[48,8],[29,0],[7,0]),
            cubic([7,0],[-12,0],[-24,5],[-34,11]),
            [[-42,0],[-48,0],[-48,42],[-42,42]],
            cubic([-42,42],[-37,18],[-19,10],[0,10]),
            cubic([0,10],[19,10],[29,18],[29,31]),
            cubic([29,31],[29,44],[15,49],[-7,58]),
            cubic([-7,58],[-31,68],[-46,78],[-46,96]),
            cubic([-46,96],[-46,116],[-26,127],[-4,127]),
            cubic([-4,127],[13,127],[26,123],[35,117]),
            [[39,127]]
        ));
    }
    
    
    module depth_extrude(y_start,depth) {
        translate([0,y_start+depth,0]) rotate([90,0,0])
            linear_extrude(height=depth,convexity=10) children();
    }
    
    // Continue the lower-right bowl behind the front letter.
    module pocket_profile(height) {
        intersection() {
            s_profile();
            square([silhouette_width,height]);
        }
    }
    
    module pocket_void() {
        depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
            intersection() {
                offset(delta=-pocket_wall)
                    pocket_profile(pocket_height+3*pocket_wall);
                translate([-silhouette_width,pocket_floor])
                    square([2*silhouette_width,pocket_height-pocket_floor+eps]);
            }
    }
    
    module stand() {
        color(body_color) difference() {
            union() {
                depth_extrude(-letter_depth/2,letter_depth) s_profile();
                depth_extrude(pocket_front,pocket_depth)
                    pocket_profile(pocket_height);
                // Extend the lower-left serif back to balance the pocket.
                depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2)
                    intersection() {
                        s_profile();
                        translate([-silhouette_width,0])
                            square([silhouette_width,foot_height]);
                    }
                // A small flat landing under the curved bowl avoids a rocking base.
                depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2)
                    square([32*sx,foot_height]);
            }
            pocket_void();
        }
    }
    
    stand();
}

module stand_T() {
    // Custom bracketed serif silhouette. Dimensions in mm; no pocket yet.
    // Font independent curves; 127 mm reference height.
    stand_height = 127;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
     u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(x,w=24,foot=12,top=true,bottom=true) {
     translate([x,0]) union() {
      translate([-w/2,0]) square([w,127]);
      if(bottom) polygon(concat([[-w/2-foot,0],[w/2+foot,0],[w/2+foot,4]],
       bezier([w/2+foot,4],[w/2,5],[w/2,21]),[[-w/2,21]],
       bezier([-w/2,21],[-w/2,5],[-w/2-foot,4])));
      if(top) polygon(concat([[-w/2-foot,127],[w/2+foot,127],[w/2+foot,123]],
       bezier([w/2+foot,123],[w/2,122],[w/2,106]),[[-w/2,106]],
       bezier([-w/2,106],[-w/2,122],[-w/2-foot,123])));
     }
    }
    
    silhouette_width = 112;
    module t_profile() {
     scale([silhouette_width/112,stand_height/127]) union() { stem(0,24,14,false,true); polygon(concat([[-56,127],[56,127],[56,91],[50,91]], cubic([50,91],[48,110],[42,119],[23,119]),[[-23,119]], cubic([-23,119],[-42,119],[-48,110],[-50,91]),[[-56,91]])); }
    }
    
    // Pen stand: front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) { intersection() { stem(0,24,14,false,true); translate([-150,0]) square([300,h]); } }
    module pocket_void() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
      offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
      translate([-150,pocket_floor]) square([300,pocket_height-pocket_floor+0.02]);
     }
    }
    module stand() {
     color([0.015,0.48,0.70]) difference() {
      union() {
       depth_extrude(-letter_depth/2,letter_depth) t_profile();
       depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
       // Carry the low base rearward for a broad, stable support footprint.
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection() { t_profile(); translate([-150,0]) square([300,4]); }
       
      }
      pocket_void();
     }
    }
    stand();
}

module stand_U() {
    // Custom bracketed serif silhouette. Dimensions in mm; no pocket yet.
    // Font independent curves; 127 mm reference height.
    stand_height = 127;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    function cubic(a,b,c,d,n=curve_steps) = [for(i=[0:n]) let(t=i/n,u=1-t)
     [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
     u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]];
    module stem(x,w=24,foot=12,top=true,bottom=true) {
     translate([x,0]) union() {
      translate([-w/2,0]) square([w,127]);
      if(bottom) polygon(concat([[-w/2-foot,0],[w/2+foot,0],[w/2+foot,4]],
       bezier([w/2+foot,4],[w/2,5],[w/2,21]),[[-w/2,21]],
       bezier([-w/2,21],[-w/2,5],[-w/2-foot,4])));
      if(top) polygon(concat([[-w/2-foot,127],[w/2+foot,127],[w/2+foot,123]],
       bezier([w/2+foot,123],[w/2,122],[w/2,106]),[[-w/2,106]],
       bezier([-w/2,106],[-w/2,122],[-w/2-foot,123])));
     }
    }
    
    silhouette_width = 124;
    module u_profile() {
     scale([silhouette_width/124,stand_height/127]) union() { polygon(concat([[-48,127],[-24,127],[-24,41]], cubic([-24,41],[-24,20],[-14,10],[3,10]), cubic([3,10],[24,10],[34,21],[34,43]), [[34,127],[48,127],[48,43]], cubic([48,43],[48,15],[30,0],[1,0]), cubic([1,0],[-31,0],[-48,15],[-48,42]))); translate([-36,0]) polygon(concat([[-26,127],[26,127],[26,123]],bezier([26,123],[12,122],[12,106]),[[-12,106]],bezier([-12,106],[-12,122],[-26,123]))); translate([41,0]) polygon(concat([[-21,127],[21,127],[21,123]],bezier([21,123],[7,122],[7,106]),[[-7,106]],bezier([-7,106],[-7,122],[-21,123]))); }
    }
    
    // Pen stand: front faces -Y. Dimensions in mm.
    $fn=72;
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_overlap=2;
    pocket_front=letter_depth/2-pocket_overlap;
    pocket_rear=pocket_front+pocket_depth;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) { intersection() { u_profile(); translate([-100,0]) square([100,h]); } }
    module pocket_void() {
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection() {
      offset(delta=-pocket_wall) pocket_profile(pocket_height+3*pocket_wall);
      translate([-150,pocket_floor]) square([300,pocket_height-pocket_floor+0.02]);
     }
    }
    module stand() {
     color([0.015,0.48,0.70]) difference() {
      union() {
       depth_extrude(-letter_depth/2,letter_depth) u_profile();
       depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
       // Carry the low base rearward for a broad, stable support footprint.
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) intersection() { u_profile(); translate([-150,0]) square([300,4]); }
       depth_extrude(-letter_depth/2,pocket_rear+letter_depth/2) { translate([-24,0]) square([48,4]); }
      }
      pocket_void();
     }
    }
    stand();
}

module stand_V() {
    // Custom bracketed serif silhouette. Dimensions in mm. Rear pen pocket included.
    // Font independent outline, matching the A/M/S family.
    stand_height = 127;
    silhouette_width = 128;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n])
     let(t=i/n,u=1-t) [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    module v_profile() {
     scale([silhouette_width/128,stand_height/127]) polygon(concat(
     [[-64,127],[-14,127],[-14,123]],
     bezier([-14,123],[-32,122],[-28,108]),
     [[7,25],[36,108]],
     bezier([36,108],[42,122],[23,123]),
     [[23,127],[64,127],[64,123]],
     bezier([64,123],[52,121],[47,106]),
     [[8,0],[-7,0],[-48,106]],
     bezier([-48,106],[-54,122],[-64,123])
     ));
    }
    
    // Front is -Y; the matching rear pocket is open at its upper edge.
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
    intersection(){ v_profile(); polygon([[-7,0],[8,0],[7,25],[-28,108],[-48,106]]); translate([-silhouette_width,0]) square([2*silhouette_width,h]); }
    }
    module pen_stand() {
     color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) v_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Wider rear landing supports pens in the inclined pocket.
     // Starts behind the front face so the approved V outline is preserved.
     depth_extrude(pocket_front,pocket_depth)
     polygon(concat([[-32,0],[20,0],[20,2]],
     bezier([20,2],[20,4],[16,4]),[[-28,4]],
     bezier([-28,4],[-32,4],[-32,2])));
     // Low rear support continues the letter's existing base footprint.
     depth_extrude(-6,36) intersection() {
     v_profile(); translate([-silhouette_width,0]) square([2*silhouette_width,4]);
     }
     }
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection(){
     offset(delta=-pocket_wall) pocket_profile(pocket_height+12);
     translate([-silhouette_width,pocket_floor]) square([2*silhouette_width,pocket_height-pocket_floor+0.02]);
     }
     }
    }
    pen_stand();
}

module stand_Z() {
    // Custom bracketed serif silhouette. Dimensions in mm. Rear pen pocket included.
    // Font independent outline, matching the A/M/S family.
    stand_height = 127;
    silhouette_width = 104;
    curve_steps = 32;
    function bezier(a,b,c,n=curve_steps) = [for(i=[0:n])
     let(t=i/n,u=1-t) [u*u*a[0]+2*u*t*b[0]+t*t*c[0],u*u*a[1]+2*u*t*b[1]+t*t*c[1]]];
    module z_profile() {
     scale([silhouette_width/104,stand_height/127]) polygon(concat(
     [[-50,127],[51,127],[51,118],[-25,11],[15,11]],
     bezier([15,11],[41,11],[45,37]),
     [[51,37],[51,0],[-52,0],[-52,9],[24,116],[-16,116]],
     bezier([-16,116],[-41,116],[-44,91]),
     [[-50,91]]
     ));
    }
    
    // Front is -Y; the matching rear pocket is open at its upper edge.
    letter_depth=12;
    pocket_height=69;
    pocket_depth=26;
    pocket_wall=2.4;
    pocket_floor=4;
    pocket_front=4;
    module depth_extrude(y_start,depth) {
     translate([0,y_start+depth,0]) rotate([90,0,0])
     linear_extrude(height=depth,convexity=10) children();
    }
    module pocket_profile(h) {
    // Exact continuation of both diagonal edges, including their base junctions.
    // The diagonal begins at z=9 on the left and z=11 on the right.
    ref_h=h/(stand_height/127);
    assert(ref_h > 11 && ref_h < 91, "Pocket must stay below the upper serif.");
    scale([silhouette_width/104,stand_height/127])
     polygon([[-52,0],[-25,0],[-25,11],
              [-25+76*(ref_h-11)/107,ref_h],
              [-52+76*(ref_h-9)/107,ref_h],[-52,9]]);
    }
    module pen_stand() {
     color([0.015,0.48,0.70]) difference() {
     union() {
     depth_extrude(-6,12) z_profile();
     depth_extrude(pocket_front,pocket_depth) pocket_profile(pocket_height);
     // Low rear support continues the letter's existing base footprint.
     depth_extrude(-6,36) intersection() {
     z_profile(); translate([-silhouette_width,0]) square([2*silhouette_width,4]);
     }
     }
     depth_extrude(pocket_front+pocket_wall,pocket_depth-2*pocket_wall)
     intersection(){
     offset(delta=-pocket_wall) pocket_profile(pocket_height+12);
     translate([-silhouette_width,pocket_floor]) square([2*silhouette_width,pocket_height-pocket_floor+0.02]);
     }
     }
    }
    pen_stand();
}

module selected_stand(letter) {
    if (letter == "A") stand_A();
    else if (letter == "B") stand_B();
    else if (letter == "C") stand_C();
    else if (letter == "D") stand_D();
    else if (letter == "G") stand_G();
    else if (letter == "H") stand_H();
    else if (letter == "J") stand_J();
    else if (letter == "L") stand_L();
    else if (letter == "M") stand_M();
    else if (letter == "N") stand_N();
    else if (letter == "P") stand_P();
    else if (letter == "R") stand_R();
    else if (letter == "S") stand_S();
    else if (letter == "T") stand_T();
    else if (letter == "U") stand_U();
    else if (letter == "V") stand_V();
    else if (letter == "Z") stand_Z();
    else assert(false, str("Unsupported letter: ", letter));
}
`
