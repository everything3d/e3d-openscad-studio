export const NAME_KEYCHAIN_SCAD = String.raw`
// Name keychain.
// A rounded badge with a keyring tab, printed flat in three colours:
// a dark base, a light inset panel, and a raised accent border and name.
// The badge grows to fit the name, and the name shrinks to fit the badge
// height, so any name prints without further edits.

/* [Name] */
name = "Ishaan";
font = "Righteous"; // font
textSize = 10;
letterSpacing = 1.0;

/* [Badge] */
// Badge height (mm); the width follows the name
badgeHeight = 23;
// Narrowest the badge gets, so short names still make a usable keychain
minBadgeWidth = 55;
// Space between the name and the accent border on each side
sidePadding = 7.5;
cornerRadius = 8;
// Width of the dark rim outside the accent border
outerBorder = 2.8;
// Width of the raised accent border
accentBorder = 2.0;

/* [Keyring hole] */
holeDiameter = 4;
tabDiameter = 9;
// How far the tab overlaps the badge body
tabOverlap = 3.5;

/* [Layer heights] */
baseHeight = 2.0;
// The light panel is inset into the base from this height up to panelTop
panelBottom = 1.0;
panelTop = 2.6;
accentBorderHeight = 1.8;
nameHeight = 2.0;

/* [Colors] */
baseColor = "#1F2933"; // color
panelColor = "#F5F5F0"; // color
accentColor = "#E63946"; // color

/* [Hidden] */
$fn = 64;
panelInset = outerBorder + accentBorder;
metrics = textmetrics(name, size = textSize, font = font, spacing = letterSpacing,
                      halign = "center", valign = "center");
// Leave at least 1.5mm of panel above and below the letters.
maxTextHeight = badgeHeight - 2 * panelInset - 3;
textScale = min(1, maxTextHeight / metrics.size.y);
textWidth = metrics.size.x * textScale;
badgeWidth = max(minBadgeWidth, textWidth + 2 * (sidePadding + panelInset));
tabX = -badgeWidth / 2 - tabDiameter / 2 + tabOverlap;

assert(holeDiameter <= tabDiameter - 3, "Keyring hole is too large for the tab; leave at least 1.5mm of wall.");
assert(cornerRadius > panelInset, "cornerRadius must be larger than outerBorder + accentBorder.");

module rounded_rect(w, h, r) {
    offset(r = r) square([w - 2 * r, h - 2 * r], center = true);
}

module badge_2d() {
    difference() {
        union() {
            rounded_rect(badgeWidth, badgeHeight, cornerRadius);
            translate([tabX, 0]) circle(d = tabDiameter);
        }
        translate([tabX, 0]) circle(d = holeDiameter);
    }
}

module panel_2d() {
    rounded_rect(badgeWidth - 2 * panelInset, badgeHeight - 2 * panelInset, cornerRadius - panelInset);
}

module accent_border_2d() {
    difference() {
        rounded_rect(badgeWidth - 2 * outerBorder, badgeHeight - 2 * outerBorder, cornerRadius - outerBorder);
        panel_2d();
    }
}

module name_2d() {
    // Recentre on the ink, not the font's nominal box, so the name sits
    // visually in the middle of the panel.
    scale([textScale, textScale])
        translate([-(metrics.position.x + metrics.size.x / 2), -(metrics.position.y + metrics.size.y / 2)])
            text(name, size = textSize, font = font, spacing = letterSpacing,
                 halign = "center", valign = "center");
}

color(baseColor)
    difference() {
        linear_extrude(height = baseHeight) badge_2d();
        translate([0, 0, panelBottom])
            linear_extrude(height = baseHeight) panel_2d();
    }

color(panelColor)
    translate([0, 0, panelBottom])
        linear_extrude(height = panelTop - panelBottom) panel_2d();

color(accentColor) {
    translate([0, 0, baseHeight])
        linear_extrude(height = accentBorderHeight) accent_border_2d();
    translate([0, 0, panelTop])
        linear_extrude(height = nameHeight) name_2d();
}
`
