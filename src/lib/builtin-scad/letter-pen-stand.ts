export const LETTER_PEN_STAND_SCAD = String.raw`
// Letter pen stand + one-piece cursive name.
// Two separate solids: an upright serif-letter pen stand with a rear pocket,
// and a flat cursive name that prints at Z=0.
//
// The stand library has 17 approved letters: A B C D G H J L M N P R S T U V Z.
// The name is built from Pacifico outlines embedded in pacifico-outlines.scad,
// with rounded bridges joining every separate piece (i/j dots, capitals that
// do not join the next letter, the gap between words) into one solid.
// Basic Latin (ASCII) names only.
use <letter-stands.scad>
use <pacifico-outlines.scad>

/* [Choose model] */
name_text = "Aditya";
// Auto uses the first non-space character of name_text.
big_letter = "auto"; // [auto,A,B,C,D,G,H,J,L,M,N,P,R,S,T,U,V,Z]
export_part = "both"; // [both,stand,name]

/* [Stand] */
// Uniform scaling of the approved 127 mm-high stand and its pocket.
stand_height_mm = 127;

/* [Separate cursive name] */
// Approximate overall width; height follows the handwriting proportions.
name_width_mm = 110;
name_thickness_mm = 10;
// Thickens every stroke slightly so thin joins survive printing.
name_stroke_expansion_mm = 0.25;
// Width of the rounded bridges that join separate pieces of the name. Extra
// width helps delicate letters withstand handling.
name_bridge_width_mm = 1.6;
// Space between the stand and the name when export_part = "both".
part_gap_mm = 25;
name_color = [1,0.98,0.94];

/* [Hidden] */
$fn = 48;
function upper(c) = ord(c)>=97 && ord(c)<=122 ? chr(ord(c)-32) : c;
function initial(s) = let(nonspace=[for(i=[0:len(s)-1]) if(s[i]!=" ") s[i]])
 assert(len(nonspace)>0,"Enter a name containing at least one letter.") upper(nonspace[0]);
chosen_letter = big_letter=="auto" ? initial(name_text) : upper(big_letter);
assert(len(name_text)>0,"Name cannot be empty.");
assert(stand_height_mm>0 && name_width_mm>0 && name_thickness_mm>0,"Dimensions must be positive.");
assert(name_bridge_width_mm>0 && name_stroke_expansion_mm>=0,"Bridge width must be positive.");
assert(export_part=="both" || export_part=="stand" || export_part=="name","Choose both, stand or name.");

function cursor_x(s,i) = i==0 ? 0 : cursor_x(s,i-1)+glyph(s[i-1])[0];
// Each record is [points, paths, sampled exterior] for one separate piece of a
// glyph, shifted to its position in the name.
function name_islands(s) = [for(i=[0:len(s)-1]) for(part=glyph(s[i])[1])
 let(x=cursor_x(s,i)) [[for(p=part[0]) p+[x,0]],part[1],[for(p=part[2]) p+[x,0]]]];
function nearest_pair(a,b) = let(
 candidates=[for(p=a) let(ds=[for(q=b) norm(p-q)],j=search(min(ds),ds)[0]) [min(ds),p,b[j]]],
 ds=[for(c=candidates)c[0]],i=search(min(ds),ds)[0]) candidates[i];

module cursive_name() {
 islands=name_islands(name_text);
 assert(len(islands)>0,"The name must contain visible characters.");
 points=[for(part=islands) each part[0]];
 xmin=min([for(p=points)p[0]]); xmax=max([for(p=points)p[0]]);
 ymin=min([for(p=points)p[1]]);
 k=(name_width_mm-2*name_stroke_expansion_mm)/(xmax-xmin);
 assert(k>0,"Name width is too small for the stroke expansion.");
 function physical(p) = (p-[xmin,ymin])*k;
 color(name_color) linear_extrude(height=name_thickness_mm,convexity=20)
 union() {
 for(part=islands) offset(delta=name_stroke_expansion_mm)
 polygon(points=[for(p=part[0])physical(p)],paths=part[1]);
 // A spanning chain guarantees one connected name: every island joins one
 // earlier island using their closest sampled outline points. Hole contours
 // remain intact.
 if(len(islands)>1) for(i=[1:len(islands)-1]) {
 previous=[for(j=[0:i-1]) each islands[j][2]];
 pair=nearest_pair(islands[i][2],previous);
 hull() {
 translate(physical(pair[1])) circle(d=name_bridge_width_mm);
 translate(physical(pair[2])) circle(d=name_bridge_width_mm);
 }
 }
 }
}

if(export_part=="stand" || export_part=="both")
 scale([1,1,1]*stand_height_mm/127) selected_stand(chosen_letter);
if(export_part=="name") cursive_name();
if(export_part=="both")
 translate([76*stand_height_mm/127+part_gap_mm,0,0]) cursive_name();
`
