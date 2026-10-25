export const PODIUM_NAMEPLATE_SCAD = String.raw`
// Podium nameplate.
// A thin rounded plate with a raised name and up to two tagline lines, sized
// to sit on the front of a figurine podium or a trophy. It prints flat in
// three colours: the plate, the name and the taglines.
//
// The name shrinks only when it would overrun the plate. The taglines grow
// together to fill the plate width, up to tagMaxSize, so short and long
// taglines both look deliberate. The text block re-centres when a tagline
// is left empty.

/* [Text] */
name = "Riya Sharma";
// Leave a tagline empty to drop it; the text re-centres
tagline1 = "Always on the go";
tagline2 = "";
nameFont = "Cutive"; // font
tagFont = "Akaya Kanadaka"; // font
// Largest name size; long names shrink to fit
nameSize = 10.5;
// Starting tagline size before growing to fill the plate width
tagSize = 4.5;
// Upper bound when a single short tagline grows
tagMaxSize = 8;
// Upper bound with two taglines, so the lines do not collide
tagMaxSizeTwoTags = 6;
// Clear space between the text and each end of the plate
sideMargin = 6;

/* [Plate] */
plateLength = 109;
plateWidth = 49;
plateThickness = 1;
cornerRadius = 5;
textHeight = 0.5;
// Thickens strokes so small text prints cleanly; 0.1–0.25 works well
boldAmount = 0.1;

/* [Layout] */
// Vertical positions of each line, measured from the plate centre
nameYTwoTags = 11;
nameYOneTag = 8.5;
tag1YTwoTags = -3;
tag1YOneTag = -9;
tag2Y = -12;

/* [Colors] */
plateColor = "#F5F5F5"; // color
nameColor = "#111111"; // color
tagColor = "#1E90FF"; // color

/* [Hidden] */
$fn = 64;
maxTextWidth = plateLength - 2 * sideMargin;

// Width text() occupies once the bold offset is applied.
function text_width(txt, size, font) =
    txt == "" ? 0 : textmetrics(txt, size = size, font = font).size.x + 2 * boldAmount;

nameFitSize = let(natural = text_width(name, nameSize, nameFont))
    natural > maxTextWidth ? nameSize * maxTextWidth / natural : nameSize;

tagCount = (tagline1 == "" ? 0 : 1) + (tagline2 == "" ? 0 : 1);

// Scale the taglines together so the wider one fills the plate, up to the cap.
tagFitSize = let(widest = max(text_width(tagline1, tagSize, tagFont), text_width(tagline2, tagSize, tagFont)))
    widest == 0 ? tagSize
    : min(tagCount == 2 ? tagMaxSizeTwoTags : tagMaxSize, tagSize * maxTextWidth / widest);
nameY = tagCount == 2 ? nameYTwoTags : (tagCount == 1 ? nameYOneTag : 0);
tag1Y = tagCount == 2 ? tag1YTwoTags : tag1YOneTag;

assert(cornerRadius * 2 < min(plateLength, plateWidth), "cornerRadius is too large for the plate.");

module plate() {
    linear_extrude(height = plateThickness)
        offset(r = cornerRadius)
            offset(delta = -cornerRadius)
                square([plateLength, plateWidth], center = true);
}

// Grow the 2D outline with offset() before extruding, so strokes print bolder.
module bold_text(txt, size, font, y) {
    if (txt != "")
        translate([0, y, plateThickness])
            linear_extrude(height = textHeight)
                offset(r = boldAmount)
                    text(txt, size = size, font = font, halign = "center", valign = "center");
}

color(plateColor) plate();
color(nameColor) bold_text(name, nameFitSize, nameFont, nameY);
color(tagColor) {
    // A single tagline sits in the tagline1 slot, whichever field holds it.
    bold_text(tagline1 == "" ? tagline2 : tagline1, tagFitSize, tagFont, tag1Y);
    if (tagCount == 2) bold_text(tagline2, tagFitSize, tagFont, tag2Y);
}
`
